import { useState, useEffect } from "react";
import {
  Chain,
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  erc20Abi,
  Hex,
  http,
  parseUnits,
  zeroAddress,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia, sepolia } from "viem/chains";
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from "@zerodev/sdk";
import { getActionSelector, getPluginsEnableTypedData as getPluginsEnableTypedDataV2, toKernelPluginManager } from "@zerodev/sdk/accounts";
import {
  getEntryPoint,
  KERNEL_V3_3,
  KernelVersionToAddressesMap,
} from "@zerodev/sdk/constants";
import {
  decodeParamsFromInitCode,
  toPermissionValidator,
} from "@zerodev/permissions";
import { CallPolicyVersion, ParamCondition, toCallPolicy } from "@zerodev/permissions/policies";
import { toECDSASigner } from "@zerodev/permissions/signers";
import { useSign7702Authorization, useWallets } from "@privy-io/react-auth";

// Chain configuration type
interface ChainConfig {
  name: string;
  chain: Chain;
  bundlerRpc: string;
  paymasterRpc: string;
  tokenAddress: string;
  tokenDecimals: number;
  receiver: string;
}

const kernelVersion = KERNEL_V3_3;
const entryPoint = getEntryPoint("0.7");
const actionSelector = getActionSelector(entryPoint.version);

// Mock backend storage
interface BackendStorage {
  sessionKeys: Record<string, string>; // walletAddress -> sessionPrivateKey
  authorizations: Record<string, Record<number, any>>; // walletAddress -> chainId -> authorization
  pluginSignatures: Record<string, Record<number, string>>; // walletAddress -> chainId -> signature
}

const mockBackendStorage: BackendStorage = {
  sessionKeys: {},
  authorizations: {},
  pluginSignatures: {},
};

export const Zerodev = () => {
  const { signAuthorization } = useSign7702Authorization();

  const { wallets } = useWallets();
  const [loading, setLoading] = useState(false);
  const [sendingTx, setSendingTx] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [txHash, setTxHash] = useState<string | null>(null);

  const CHAIN_CONFIGS = new Map<number, ChainConfig>([
    [sepolia.id, {
      name: "Sepolia",
      chain: sepolia,
      bundlerRpc: process.env.NEXT_PUBLIC_SEPOLIA_BUNDLER_RPC || "",
      paymasterRpc: process.env.NEXT_PUBLIC_SEPOLIA_PAYMASTER_RPC || "",
      tokenAddress: "0xD46A1FF97544c8a254331C34eebEf2eA519Ad1FF",
      tokenDecimals: 6,
      receiver: "0x6d3a55F6f2923F1e00Ba0a3e611D98AdEAaC8Ee8",
    }],
    [arbitrumSepolia.id, {
      name: "Arbitrum Sepolia",
      chain: arbitrumSepolia,
      bundlerRpc: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_BUNDLER_RPC || "",
      paymasterRpc: process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_PAYMASTER_RPC || "",
      tokenAddress: "0x5E2522c505A543fA2714c617E3Cd133a6Daa9627", // USDC on Arbitrum Sepolia
      tokenDecimals: 6,
      receiver: "0x6d3a55F6f2923F1e00Ba0a3e611D98AdEAaC8Ee8",
    }],
  ]);

  // Multi-chain states
  const [balances, setBalances] = useState<Record<number, { balance: string; tokenName: string }>>({});
  const [receiverBalances, setReceiverBalances] = useState<Record<number, { balance: string; tokenName: string }>>({});
  const [selectedChainForTx, setSelectedChainForTx] = useState<number>(sepolia.id);

  // States for frontend/backend separation
  const [backendSavedAddresses, setBackendSavedAddresses] = useState<Record<number, string[]>>({});
  const [selectedAddress, setSelectedAddress] = useState<string>("");

  // Find the embedded wallet
  const privyEmbeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy"
  );

  // Function to fetch token balance and name for all chains (用户充值地址)
  const fetchAllBalances = async () => {
    if (!privyEmbeddedWallet?.address) return;

    const newBalances: Record<number, { balance: string; tokenName: string }> = {};

    // Fetch balances for all chains in parallel
    await Promise.all(
      Array.from(CHAIN_CONFIGS.entries()).map(async ([chainId, chainConfig]) => {
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
          newBalances[chainId] = {
            balance: formattedBalance,
            tokenName: name as string,
          };
        } catch (error) {
          console.error(`Failed to fetch balance for ${chainConfig.name}:`, error);
          newBalances[chainId] = {
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
      Array.from(CHAIN_CONFIGS.entries()).map(async ([chainId, chainConfig]) => {
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
          newReceiverBalances[chainId] = {
            balance: formattedBalance,
            tokenName: name as string,
          };
        } catch (error) {
          console.error(`Failed to fetch receiver balance for ${chainConfig.name}:`, error);
          newReceiverBalances[chainId] = {
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
      updateBackendSavedAddresses(); // Initial fetch for backend saved addresses

      const interval = setInterval(() => {
        fetchAllBalances();
        fetchReceiverBalances();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [privyEmbeddedWallet?.address]);

  const getTxChainConfig = () => {
    return CHAIN_CONFIGS.get(selectedChainForTx) || CHAIN_CONFIGS.get(sepolia.id)!;
  };

  // Early return conditions after all hooks have been called
  if (!privyEmbeddedWallet) {
    console.error("❌ No embedded wallet found");
    return null;
  }

  // Backend function: Generate session key and signing data
  const getDataToSign = async (walletAddress: string) => {
    // Generate session key for this wallet
    const sessionPrivateKey = generatePrivateKey();
    const sessionKeySigner = await toECDSASigner({
      signer: privateKeyToAccount(sessionPrivateKey),
    });

    mockBackendStorage.sessionKeys[walletAddress] = sessionPrivateKey;

    const authToSignData: Record<number, any> = {};
    const pluginsToSignData: Record<number, any> = {};

    for (const [chainId, chainConfig] of CHAIN_CONFIGS.entries()) {
      if (!chainConfig.bundlerRpc || !chainConfig.paymasterRpc) {
        continue;
      }

      try {
        const publicClient = createPublicClient({
          chain: chainConfig.chain,
          transport: http(),
        });

        // Prepare permission policy for this chain
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

        // Generate auth to sign data
        const authToSign = {
          contractAddress: KernelVersionToAddressesMap[kernelVersion].accountImplementationAddress,
          chainId: chainConfig.chain.id,
        };
        authToSignData[chainConfig.chain.id] = authToSign;

        // Generate plugins to sign data
        const pluginsToSign = await getPluginsEnableTypedDataV2({
          accountAddress: walletAddress as `0x${string}`,
          chainId: chainConfig.chain.id,
          kernelVersion: kernelVersion,
          action: { selector: actionSelector, address: zeroAddress },
          hook: undefined,
          validator: permissionPlugin,
          validatorNonce: 1,
        });
        pluginsToSignData[chainConfig.chain.id] = pluginsToSign;

      } catch (error) {
        console.error(`Failed to prepare signing data for ${chainConfig.name}:`, error);
      }
    }

    return { authToSignData, pluginsToSignData };
  };

  // Backend function: Save authorizations and plugin signatures
  const submitSignatures = async (walletAddress: string, authorizations: Record<number, any>, pluginSignatures: Record<number, string>) => {
    mockBackendStorage.authorizations[walletAddress] = authorizations;
    mockBackendStorage.pluginSignatures[walletAddress] = pluginSignatures;

    // Update backend saved addresses
    await updateBackendSavedAddresses();

    return { success: true };
  };

  // Backend function: Get saved addresses
  const getSavedAddresses = async () => {
    const savedAddresses: Record<number, string[]> = {};

    for (const [walletAddress, chainAuths] of Object.entries(mockBackendStorage.authorizations)) {
      for (const chainId of Object.keys(chainAuths)) {
        const chainIdNum = Number(chainId);
        if (!savedAddresses[chainIdNum]) {
          savedAddresses[chainIdNum] = [];
        }
        if (!savedAddresses[chainIdNum].includes(walletAddress)) {
          savedAddresses[chainIdNum].push(walletAddress);
        }
      }
    }

    console.log("savedAddresses:", savedAddresses);

    return savedAddresses;
  };

  // Backend function: Send transaction
  const sendTransaction = async (chainId: number, address: string, amount: string) => {
    const chainConfig = CHAIN_CONFIGS.get(chainId);
    if (!chainConfig) {
      throw new Error("Chain not found");
    }

    // Check if we have authorization and plugin signature for this address and chain
    const authorization = mockBackendStorage.authorizations[address]?.[chainId];
    const pluginSignature = mockBackendStorage.pluginSignatures[address]?.[chainId];
    const sessionPrivateKey = mockBackendStorage.sessionKeys[address];

    if (!authorization || !pluginSignature || !sessionPrivateKey) {
      throw new Error("Missing authorization or plugin signature for this address and chain");
    }

    // Build session key account and send transaction
    const sessionKeySigner = await toECDSASigner({
      signer: privateKeyToAccount(sessionPrivateKey as Hex),
    });

    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(),
    });

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

    const modularPermissionPlugin = await toPermissionValidator(publicClient, {
      signer: sessionKeySigner,
      policies: [callPolicy],
      entryPoint,
      kernelVersion
    });

    const { index, validatorInitData, useMetaFactory } =
      decodeParamsFromInitCode("0x", kernelVersion);

    const kernelPluginManager = await toKernelPluginManager(publicClient, {
      regular: modularPermissionPlugin,
      pluginEnableSignature: pluginSignature as Hex,
      validatorInitData,
      action: { selector: actionSelector, address: zeroAddress },
      entryPoint,
      kernelVersion,
      isPreInstalled: false,
      ...{
        validAfter: 0,
        validUntil: 0
      }
    });

    const sessionKeyAccount = await createKernelAccount(publicClient, {
      entryPoint,
      kernelVersion,
      plugins: kernelPluginManager,
      index,
      address: address as `0x${string}`,
      useMetaFactory,
      eip7702Auth: authorization
    });

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

    const call = [
      {
        to: chainConfig.tokenAddress as `0x${string}`,
        value: BigInt(0),
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [chainConfig.receiver as `0x${string}`, parseUnits(amount, chainConfig.tokenDecimals)],
        }),
      },
    ];

    const userOpHash = await kernelClient.sendUserOperation({
      callData: await sessionKeyAccount.encodeCalls(call),
    });

    console.log("userOp hash:", userOpHash);

    const _receipt = await kernelClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });

    return _receipt.receipt.transactionHash;
  };

  // Function to update backend saved addresses
  const updateBackendSavedAddresses = async () => {
    try {
      const savedAddresses = await getSavedAddresses();
      setBackendSavedAddresses(savedAddresses);
    } catch (error) {
      console.error("Failed to update backend saved addresses:", error);
    }
  };

  const frontEndJustSign = async () => {
    if (!privyEmbeddedWallet?.address) {
      alert("请先连接钱包");
      return;
    }

    setLoading(true);

    try {
      // Step 1: Call backend to get signing data
      const { authToSignData, pluginsToSignData } = await getDataToSign(privyEmbeddedWallet.address);

      // Step 2: Sign the data for all chains (frontend only signs what it receives)
      const authorizations: Record<number, any> = {};
      const pluginSignatures: Record<number, string> = {};

      // Sign authorization data for each chain
      for (const [chainIdStr, authData] of Object.entries(authToSignData)) {
        try {
          const chainId = Number(chainIdStr);
          // Privy SDK should provides signAuthorization method
          const authorization = await signAuthorization(authData);
          authorizations[chainId] = authorization;
        } catch (error) {
          console.error(`❌ Failed to sign authorization for chain ${chainIdStr}:`, error);
        }
      }

      // Sign plugin data for each chain
      for (const [chainIdStr, pluginData] of Object.entries(pluginsToSignData)) {
        try {
          const chainId = Number(chainIdStr);
          const chainConfig = CHAIN_CONFIGS.get(chainId);
          if (!chainConfig) {
            console.error(`❌ Chain config not found for chainId: ${chainId}`);
            continue;
          }

          const privyWallet = createWalletClient({
            account: privyEmbeddedWallet.address as Hex,
            chain: chainConfig.chain,
            transport: custom(await privyEmbeddedWallet.getEthereumProvider()),
          });

          const pluginEnableSignature = await privyWallet.signTypedData(pluginData);
          pluginSignatures[chainId] = pluginEnableSignature;
        } catch (error) {
          console.error(`❌ Failed to sign plugin data for chain ${chainIdStr}:`, error);
        }
      }

      // Step 3: Call backend to submit signatures
      await submitSignatures(privyEmbeddedWallet.address, authorizations, pluginSignatures);

      console.log("✅ Authorization and plugin signatures generated successfully");
    } catch (e) {
      console.error("❌ frontEndJustSign failed:", e);
      const error = e as any;

      // Show user-friendly error message
      let errorMessage = "多链授权生成失败。";
      if (error?.message) {
        errorMessage += `错误: ${error.message}`;
      } else {
        errorMessage += "请查看控制台获取详细信息。";
      }
      alert(errorMessage);

    } finally {
      setLoading(false);
    }
  };

  const backEndSendTx = async () => {
    if (!selectedAddress) {
      alert("请选择地址");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert("请输入有效的转账金额");
      return;
    }

    setSendingTx(true);
    setTxHash(null);

    try {
      // Call backend to send transaction
      const resultTxHash = await sendTransaction(selectedChainForTx, selectedAddress, amount);
      setTxHash(resultTxHash);

      console.log("✅ Transaction sent successfully:", resultTxHash);
      alert("交易发送成功！");

    } catch (e) {
      console.error("❌ backEndSendTx failed:", e);
      const error = e as any;

      // Show user-friendly error message
      let errorMessage = "交易发送失败。";
      if (error?.message) {
        errorMessage += `错误: ${error.message}`;
      } else {
        errorMessage += "请查看控制台获取详细信息。";
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
              <h3 className="text-base font-bold text-gray-800">用户充值地址</h3>
            </div>

            <div className="space-y-3">
              <div className="bg-white p-3 rounded border border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600">地址</span>
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
                  <span className="text-xs font-medium text-gray-600">余额</span>
                  <span className="text-xs text-gray-500">所有链</span>
                </div>
                <div className="space-y-1">
                  {Array.from(CHAIN_CONFIGS.entries()).map(([chainId, chainConfig]) => {
                    const chainBalance = balances[chainId];
                    return (
                      <div key={chainId} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-b-0">
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
            <h3 className="text-base font-bold text-gray-800">金库地址</h3>
          </div>

          <div className="space-y-3">
            {Array.from(CHAIN_CONFIGS.entries()).map(([chainId, chainConfig]) => {
              const chainBalance = receiverBalances[chainId];
              return (
                <div key={chainId} className="bg-white p-3 rounded border border-gray-200">
                  <div className="flex items-center mb-2">
                    <div className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-2"></div>
                    <span className="text-xs font-semibold text-gray-800">{chainConfig.name}</span>
                  </div>

                  <div className="space-y-2">
                    {/* Deposit Address */}
                    <div className="border-b border-gray-100 pb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">地址</span>
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
                      <span className="text-xs text-gray-600">余额</span>
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
            <h3 className="text-base font-bold text-purple-700">前端操作：提交授权</h3>
          </div>

          <div className="space-y-3">
            <div className="bg-white p-3 rounded border border-gray-200">
              <div className="text-xs text-gray-500">
                支持的链: {Array.from(CHAIN_CONFIGS.values()).map(c => c.name).join(', ')}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={frontEndJustSign}
                disabled={loading}
                className="flex items-center px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-400 text-white text-xs font-medium rounded shadow-sm transition-colors duration-200"
              >
                {loading && (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                )}
                {loading ? "提交授权中..." : "提交授权"}
              </button>
            </div>
          </div>
        </div>

        {/* Backend: Send Transaction Section */}
        <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
          <div className="flex items-center mb-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            <h3 className="text-base font-bold text-blue-700">后端操作：发起转账</h3>
          </div>

          <div className="space-y-3">
            {/* Chain Selection for Transaction */}
            <div className="bg-white p-3 rounded border border-gray-200">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                选择链
              </label>
              <select
                value={selectedChainForTx}
                onChange={(e) => {
                  setSelectedChainForTx(Number(e.target.value));
                  setSelectedAddress(""); // Reset address selection when chain changes
                }}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                disabled={sendingTx}
              >
                {Array.from(CHAIN_CONFIGS.entries()).map(([chainId, chainConfig]) => (
                  <option key={chainId} value={chainId}>
                    {chainConfig.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Address Selection */}
            <div className="bg-white p-3 rounded border border-gray-200">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                选择地址 (仅显示已授权的地址)
              </label>
              <select
                value={selectedAddress}
                onChange={(e) => setSelectedAddress(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                disabled={sendingTx}
              >
                <option value="">请选择地址</option>
                {backendSavedAddresses[selectedChainForTx]?.map((address) => (
                  <option key={address} value={address}>
                    {address}
                  </option>
                ))}
              </select>
              {(!backendSavedAddresses[selectedChainForTx] || backendSavedAddresses[selectedChainForTx].length === 0) && (
                <div className="text-xs text-gray-500 mt-1">
                  该链暂无已授权的地址，请先生成授权
                </div>
              )}
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
                  disabled={sendingTx || !amount || !selectedAddress}
                  className="flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xs font-medium rounded shadow-sm transition-colors duration-200"
                >
                  {sendingTx && (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                  )}
                  {sendingTx ? "发送中..." : `发起转账`}
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
