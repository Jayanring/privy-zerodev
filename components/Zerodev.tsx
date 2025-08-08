import {
  createPublicClient,
  createWalletClient,
  custom,
  Hex,
  http,
  zeroAddress,
  encodeFunctionData,
} from "viem";
import {
  getEntryPoint,
  KERNEL_V3_3,
  KernelVersionToAddressesMap,
} from "@zerodev/sdk/constants";
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from "@zerodev/sdk";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia, arbitrumSepolia } from "viem/chains";
import { useSign7702Authorization, useWallets } from "@privy-io/react-auth";
import { useState, useEffect } from "react";
import { toECDSASigner } from "@zerodev/permissions/signers";
import { CallPolicyVersion, ParamCondition, toCallPolicy } from "@zerodev/permissions/policies";
import { erc20Abi, parseUnits } from "viem";
import { deserializePermissionAccount, serializePermissionAccount, toPermissionValidator } from "@zerodev/permissions";
import { Chain } from "viem";

// Chain configuration type
interface ChainConfig {
  configId: number; // Unique identifier for this configuration
  name: string;
  chain: Chain;
  bundlerRpc: string;
  paymasterRpc: string;
  tokenAddress: string;
  tokenDecimals: number;
  receiver: string;
}

// Multi-chain configuration
const CHAIN_CONFIGS: ChainConfig[] = [
  {
    configId: 1,
    name: "Sepolia",
    chain: sepolia,
    bundlerRpc: process.env.NEXT_PUBLIC_SEPOLIA_BUNDLER_RPC || "",
    paymasterRpc: process.env.NEXT_PUBLIC_SEPOLIA_PAYMASTER_RPC || "",
    tokenAddress: "0xD46A1FF97544c8a254331C34eebEf2eA519Ad1FF",
    tokenDecimals: 6,
    receiver: "0x6d3a55F6f2923F1e00Ba0a3e611D98AdEAaC8Ee8",
  },
  {
    configId: 2,
    name: "Arbitrum Sepolia",
    chain: arbitrumSepolia,
    bundlerRpc: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_BUNDLER_RPC || "",
    paymasterRpc: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_PAYMASTER_RPC || "",
    tokenAddress: "0x5E2522c505A543fA2714c617E3Cd133a6Daa9627", // USDC on Arbitrum Sepolia
    tokenDecimals: 6,
    receiver: "0x6d3a55F6f2923F1e00Ba0a3e611D98AdEAaC8Ee8",
  },
];

const kernelVersion = KERNEL_V3_3;
const entryPoint = getEntryPoint("0.7");

export const Zerodev = () => {
  const { signAuthorization } = useSign7702Authorization();

  const { wallets } = useWallets();
  const [loading, setLoading] = useState(false);
  const [sendingTx, setSendingTx] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);

  // Multi-chain states
  const [selectedChainId, setSelectedChainId] = useState<number>(CHAIN_CONFIGS[0].configId);
  const [balances, setBalances] = useState<Record<number, { balance: string; tokenName: string }>>({});
  const [receiverBalances, setReceiverBalances] = useState<Record<number, { balance: string; tokenName: string }>>({});
  const [selectedChainForTx, setSelectedChainForTx] = useState<number>(CHAIN_CONFIGS[0].configId);

  // States for frontend/backend separation
  const [generatedSessionKey, setGeneratedSessionKey] = useState<string>("");
  const [generatedApproval, setGeneratedApproval] = useState<string>("");
  const [inputSessionKey, setInputSessionKey] = useState<string>("");
  const [inputApproval, setInputApproval] = useState<string>("");

  // Find the embedded wallet
  const privyEmbeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy"
  );

  // Function to fetch token balance and name for all chains (Privy Wallet)
  const fetchAllBalances = async () => {
    if (!privyEmbeddedWallet?.address) return;

    const newBalances: Record<number, { balance: string; tokenName: string }> = {};

    // Fetch balances for all chains in parallel
    await Promise.all(
      CHAIN_CONFIGS.map(async (chainConfig) => {
        try {
          const publicClient = createPublicClient({
            chain: chainConfig.chain,
            transport: http(),
          });

          const [balance, name] = await Promise.all([
            publicClient.readContract({
              address: chainConfig.tokenAddress as `0x${string}`,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [privyEmbeddedWallet.address as `0x${string}`],
            }),
            publicClient.readContract({
              address: chainConfig.tokenAddress as `0x${string}`,
              abi: erc20Abi,
              functionName: 'name',
            })
          ]);

          // Convert balance from wei to readable format
          const formattedBalance = (Number(balance) / Math.pow(10, chainConfig.tokenDecimals)).toFixed(6);
          newBalances[chainConfig.configId] = {
            balance: formattedBalance,
            tokenName: name as string,
          };
        } catch (error) {
          console.error(`Failed to fetch balance for ${chainConfig.name}:`, error);
          newBalances[chainConfig.configId] = {
            balance: "Error",
            tokenName: "Token",
          };
        }
      })
    );

    setBalances(newBalances);
  };

  // Function to fetch receiver address balances for all chains
  const fetchReceiverBalances = async () => {
    const newReceiverBalances: Record<number, { balance: string; tokenName: string }> = {};

    // Fetch receiver balances for all chains in parallel
    await Promise.all(
      CHAIN_CONFIGS.map(async (chainConfig) => {
        try {
          const publicClient = createPublicClient({
            chain: chainConfig.chain,
            transport: http(),
          });

          const [balance, name] = await Promise.all([
            publicClient.readContract({
              address: chainConfig.tokenAddress as `0x${string}`,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [chainConfig.receiver as `0x${string}`],
            }),
            publicClient.readContract({
              address: chainConfig.tokenAddress as `0x${string}`,
              abi: erc20Abi,
              functionName: 'name',
            })
          ]);

          // Convert balance from wei to readable format
          const formattedBalance = (Number(balance) / Math.pow(10, chainConfig.tokenDecimals)).toFixed(6);
          newReceiverBalances[chainConfig.configId] = {
            balance: formattedBalance,
            tokenName: name as string,
          };
        } catch (error) {
          console.error(`Failed to fetch receiver balance for ${chainConfig.name}:`, error);
          newReceiverBalances[chainConfig.configId] = {
            balance: "Error",
            tokenName: "Token",
          };
        }
      })
    );

    setReceiverBalances(newReceiverBalances);
  };

  // Effect to fetch balance every 5 seconds
  useEffect(() => {
    if (privyEmbeddedWallet?.address) {
      fetchAllBalances(); // Initial fetch
      fetchReceiverBalances(); // Initial fetch for receiver balances

      const interval = setInterval(() => {
        fetchAllBalances();
        fetchReceiverBalances();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [privyEmbeddedWallet?.address]);

  // Helper function to get current chain config
  const getCurrentChainConfig = () => {
    return CHAIN_CONFIGS.find(config => config.configId === selectedChainId) || CHAIN_CONFIGS[0];
  };

  const getTxChainConfig = () => {
    return CHAIN_CONFIGS.find(config => config.configId === selectedChainForTx) || CHAIN_CONFIGS[0];
  };

  // Early return conditions after all hooks have been called
  if (!privyEmbeddedWallet) {
    console.error("❌ No embedded wallet found");
    // alert(`No embedded wallet found. Available wallet types: ${wallets.map(w => w.walletClientType).join(', ')}. Please connect your wallet first.`);
    return null;
  }

  // Check if at least one chain has valid RPC configuration
  const hasValidChainConfig = CHAIN_CONFIGS.some(config => config.bundlerRpc && config.paymasterRpc);
  if (!hasValidChainConfig) {
    console.error("❌ Missing required environment variables for all chains");
    alert("Missing required environment variables. Please check your chain RPC configurations.");
    return null;
  }

  const frontEndGenerateApproval = async () => {
    setLoading(true);

    try {
      const chainConfig = getCurrentChainConfig();

      // Step1: Prepare
      const publicClient = createPublicClient({
        chain: chainConfig.chain,
        transport: http(),
      });

      const privyWallet = createWalletClient({
        account: privyEmbeddedWallet.address as Hex,
        chain: chainConfig.chain,
        transport: custom(await privyEmbeddedWallet.getEthereumProvider()),
      });

      // Step2: Create session key
      const sessionPrivateKey = generatePrivateKey();
      const sessionKeySigner = await toECDSASigner({
        signer: privateKeyToAccount(sessionPrivateKey),
      });

      // Step3: Prepare permissionPlugin
      const callPolicy = toCallPolicy({
        policyVersion: CallPolicyVersion.V0_0_4,
        permissions: [
          {
            target: chainConfig.tokenAddress as `0x${string}`,
            valueLimit: BigInt(0),
            abi: erc20Abi,
            functionName: "transfer",
            args: [
              {
                condition: ParamCondition.NOT_EQUAL,
                value: zeroAddress,
              },
              {
                condition: ParamCondition.GREATER_THAN,
                value: 0n,
              },
            ],
          },
        ],
      });

      const permissionPlugin = await toPermissionValidator(publicClient, {
        entryPoint,
        kernelVersion,
        signer: sessionKeySigner,
        policies: [callPolicy],
      });

      // Step4: Approve session key
      const authorization = await signAuthorization({
        contractAddress: KernelVersionToAddressesMap[kernelVersion].accountImplementationAddress,
        chainId: chainConfig.chain.id,
      });

      const sessionKeyAccount = await createKernelAccount(publicClient, {
        entryPoint,
        kernelVersion,
        eip7702Account: privyWallet,
        eip7702Auth: authorization,
        plugins: {
          regular: permissionPlugin,
        },
      });

      const approval = await serializePermissionAccount(sessionKeyAccount);

      // Save generated data for display
      setGeneratedSessionKey(sessionPrivateKey);
      setGeneratedApproval(approval);

      console.log("sessionKeyAccount", sessionKeyAccount.address)
      console.log("approval: ", approval);
      console.log("sessionPrivateKey: ", sessionPrivateKey);
      console.log(`✅ frontEndGenerateApproval OK for ${chainConfig.name}`);
    } catch (e) {
      console.error("❌ frontEndGenerateApproval failed:", e);
      const error = e as any;

      // Show user-friendly error message
      let errorMessage = "frontEndGenerateApproval failed. ";
      if (error?.message) {
        errorMessage += `Error: ${error.message}`;
      } else {
        errorMessage += "Please check the console for details.";
      }
      alert(errorMessage);

    } finally {
      setLoading(false);
    }
  };

  const backEndSendTx = async () => {
    if (!inputSessionKey || inputSessionKey === "0x") {
      alert("请输入 Session Private Key");
      return;
    }

    if (!inputApproval) {
      alert("请输入 Approval 数据");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert("请输入有效的转账金额");
      return;
    }

    setSendingTx(true);
    setTxHash(null);

    try {
      const chainConfig = getTxChainConfig();

      // Create public client for selected chain
      const publicClient = createPublicClient({
        chain: chainConfig.chain,
        transport: http(),
      });

      const sessionKeySigner = await toECDSASigner({
        signer: privateKeyToAccount(inputSessionKey as `0x${string}`),
      });

      const sessionKeyAccount = await deserializePermissionAccount(
        publicClient,
        entryPoint,
        KERNEL_V3_3,
        inputApproval,
        sessionKeySigner
      );
      console.log("sessionKeyAccount", sessionKeyAccount.address)

      const kernelPaymaster = createZeroDevPaymasterClient({
        chain: chainConfig.chain,
        transport: http(chainConfig.paymasterRpc),
      });
      const kernelClient = createKernelAccountClient({
        account: sessionKeyAccount,
        chain: chainConfig.chain,
        bundlerTransport: http(chainConfig.bundlerRpc),
        paymaster: kernelPaymaster,
      });

      const userOpHash = await kernelClient.sendUserOperation({
        callData: await sessionKeyAccount.encodeCalls([
          {
            to: chainConfig.tokenAddress as `0x${string}`,
            value: BigInt(0),
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "transfer",
              args: [chainConfig.receiver as `0x${string}`, parseUnits(amount, chainConfig.tokenDecimals)],
            }),
          },
        ]),
      });

      console.log("userOp hash:", userOpHash);

      const _receipt = await kernelClient.waitForUserOperationReceipt({
        hash: userOpHash,
      });
      const txHash = _receipt.receipt.transactionHash;

      setTxHash(txHash);
      console.log(`✅ Transaction sent successfully on ${chainConfig.name}:`, txHash);
      alert(`Transaction sent successfully on ${chainConfig.name}! Hash: ${txHash}`);
    } catch (e) {
      console.error("❌ backEndSendTx failed:", e);
      const error = e as any;

      // Show user-friendly error message
      let errorMessage = "Transaction failed. ";
      if (error?.message) {
        errorMessage += `Error: ${error.message}`;
      } else {
        errorMessage += "Please check the console for details.";
      }
      alert(errorMessage);
    } finally {
      setSendingTx(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left Column */}
      <div className="space-y-3">
        {/* Wallet Info Section */}
        {privyEmbeddedWallet && (
          <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="flex items-center mb-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <h3 className="text-base font-bold text-gray-800">Privy Wallet</h3>
            </div>

            <div className="space-y-3">
              <div className="bg-white p-3 rounded border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">钱包地址</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(privyEmbeddedWallet.address)}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    复制
                  </button>
                </div>
                <div className="font-mono text-xs text-gray-800 bg-gray-50 p-2 rounded break-all">
                  {privyEmbeddedWallet.address}
                </div>
              </div>

              {/* Multi-chain Token Balances */}
              <div className="bg-white p-3 rounded border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-600">代币余额</span>
                  <span className="text-xs text-gray-500">所有链</span>
                </div>
                <div className="space-y-1">
                  {CHAIN_CONFIGS.map((chainConfig) => {
                    const chainBalance = balances[chainConfig.configId];
                    return (
                      <div key={chainConfig.configId} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-b-0">
                        <div className="flex items-center">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></div>
                          <span className="text-xs text-gray-700">{chainConfig.name}</span>
                        </div>
                        <span className="text-xs font-medium text-gray-800">
                          {chainBalance ? `${chainBalance.balance} ${chainBalance.tokenName}` : "加载中..."}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Chain Deposit Addresses and Balances Section */}
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
          <div className="flex items-center mb-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full mr-2"></div>
            <h3 className="text-base font-bold text-gray-800">链存入地址和余额</h3>
          </div>

          <div className="space-y-3">
            {CHAIN_CONFIGS.map((chainConfig) => {
              const chainBalance = receiverBalances[chainConfig.configId];
              return (
                <div key={chainConfig.configId} className="bg-white p-3 rounded border border-gray-200">
                  <div className="flex items-center mb-2">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-2"></div>
                    <span className="text-xs font-semibold text-gray-800">{chainConfig.name}</span>
                  </div>

                  <div className="space-y-2">
                    {/* Deposit Address */}
                    <div className="border-b border-gray-100 pb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">存入地址</span>
                        <button
                          onClick={() => navigator.clipboard.writeText(chainConfig.receiver)}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          复制
                        </button>
                      </div>
                      <div className="font-mono text-xs text-gray-800 bg-gray-50 p-2 rounded break-all">
                        {chainConfig.receiver}
                      </div>
                    </div>

                    {/* Token Balance */}
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs text-gray-600">代币余额</span>
                      <span className="text-xs font-medium text-gray-800">
                        {chainBalance ? `${chainBalance.balance} ${chainBalance.tokenName}` : "加载中..."}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="space-y-3">

        {/* Frontend: Generate Approval Section */}
        <div className="p-4 bg-gradient-to-r from-purple-50 to-violet-50 rounded-lg border border-purple-200">
          <div className="flex items-center mb-3">
            <div className="w-2 h-2 bg-purple-500 rounded-full mr-2"></div>
            <h3 className="text-base font-bold text-purple-700">前端操作：生成授权</h3>
          </div>

          <div className="space-y-3">
            {/* Chain Selection for Frontend */}
            <div className="bg-white p-3 rounded border border-gray-200">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                选择链
              </label>
              <select
                value={selectedChainId}
                onChange={(e) => setSelectedChainId(Number(e.target.value))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                disabled={loading}
              >
                {CHAIN_CONFIGS.map((chainConfig) => (
                  <option key={chainConfig.configId} value={chainConfig.configId}>
                    {chainConfig.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={frontEndGenerateApproval}
                disabled={loading || !getCurrentChainConfig().bundlerRpc || !getCurrentChainConfig().paymasterRpc}
                className="flex items-center px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-400 text-white text-xs font-medium rounded shadow-sm transition-colors duration-200"
              >
                {loading && (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                )}
                {loading ? "生成中..." : `在 ${getCurrentChainConfig().name} 上生成授权`}
              </button>
            </div>
          </div>
        </div>

        {/* Display Generated Data */}
        {generatedSessionKey && generatedApproval && (
          <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
            <div className="flex items-center mb-3">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <h3 className="text-base font-bold text-green-700">生成成功！请复制以下数据</h3>
            </div>

            <div className="space-y-3">
              <div className="bg-white p-3 rounded border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">Session Private Key</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(generatedSessionKey)}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    复制
                  </button>
                </div>
                <div className="font-mono text-xs text-gray-800 bg-gray-50 p-2 rounded break-all">
                  {generatedSessionKey}
                </div>
              </div>

              <div className="bg-white p-3 rounded border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">Approval Data</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(generatedApproval)}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    复制
                  </button>
                </div>
                <div className="font-mono text-xs text-gray-800 bg-gray-50 p-2 rounded break-all max-h-24 overflow-y-auto">
                  {generatedApproval}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Backend: Send Transaction Section */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
          <div className="flex items-center mb-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            <h3 className="text-base font-bold text-blue-700">后端操作：发送交易</h3>
          </div>

          <div className="space-y-3">
            {/* Chain Selection for Transaction */}
            <div className="bg-white p-3 rounded border border-gray-200">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                选择链
              </label>
              <select
                value={selectedChainForTx}
                onChange={(e) => setSelectedChainForTx(Number(e.target.value))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                disabled={sendingTx}
              >
                {CHAIN_CONFIGS.map((chainConfig) => (
                  <option key={chainConfig.configId} value={chainConfig.configId}>
                    {chainConfig.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-white p-3 rounded border border-gray-200">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Session Private Key
              </label>
              <textarea
                placeholder="请粘贴 Session Private Key..."
                value={inputSessionKey}
                onChange={(e) => setInputSessionKey(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                rows={2}
                disabled={sendingTx}
              />
            </div>

            <div className="bg-white p-3 rounded border border-gray-200">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Approval Data
              </label>
              <textarea
                placeholder="请粘贴 Approval 数据..."
                value={inputApproval}
                onChange={(e) => setInputApproval(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                rows={3}
                disabled={sendingTx}
              />
            </div>

            <div className="bg-white p-3 rounded border border-gray-200">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                转账金额
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="输入转账金额"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  disabled={sendingTx}
                />
                <button
                  onClick={backEndSendTx}
                  disabled={sendingTx || !amount || !inputSessionKey || !inputApproval || !getTxChainConfig().bundlerRpc || !getTxChainConfig().paymasterRpc}
                  className="flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xs font-medium rounded shadow-sm transition-colors duration-200"
                >
                  {sendingTx && (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                  )}
                  {sendingTx ? "发送中..." : `发送交易`}
                </button>
              </div>
            </div>
          </div>
        </div>



        {txHash && (
          <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg border border-emerald-200">
            <div className="flex items-center mb-3">
              <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center mr-2">
                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-green-700">交易发送成功！</h3>
            </div>

            <div className="bg-white p-3 rounded border border-gray-200">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600">交易哈希</span>
                <button
                  onClick={() => navigator.clipboard.writeText(txHash)}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  复制
                </button>
              </div>
              <div className="font-mono text-xs text-gray-800 bg-gray-50 p-2 rounded break-all mb-2">
                {txHash}
              </div>
              <a
                href={`${getTxChainConfig().chain.blockExplorers?.default?.url}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded shadow-sm transition-colors duration-200"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                在区块链浏览器中查看
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
