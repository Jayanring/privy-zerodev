import {
  createPublicClient,
  createWalletClient,
  custom,
  Hex,
  http,
  zeroAddress,
  encodeFunctionData,
} from "viem";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import {
  getEntryPoint,
  KERNEL_V3_3,
  KernelVersionToAddressesMap,
} from "@zerodev/sdk/constants";
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  KernelAccountClient,
} from "@zerodev/sdk";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { useSignAuthorization, useWallets } from "@privy-io/react-auth";
import { useState, useEffect } from "react";
import { toECDSASigner } from "@zerodev/permissions/signers";
import { CallPolicyVersion, ParamCondition, toCallPolicy } from "@zerodev/permissions/policies";
import { erc20Abi, parseUnits } from "viem";
import { toPermissionValidator } from "@zerodev/permissions";

const bundlerRpc = process.env.NEXT_PUBLIC_BUNDLER_RPC;

const paymasterRpc = process.env.NEXT_PUBLIC_PAYMASTER_RPC;

const TOKEN_ADDRESS = "0xD46A1FF97544c8a254331C34eebEf2eA519Ad1FF";
const TOKEN_DECIMALS = 6;
const RECEIVER = "0x6d3a55F6f2923F1e00Ba0a3e611D98AdEAaC8Ee8";

const chain = sepolia;
const kernelVersion = KERNEL_V3_3;
const entryPoint = getEntryPoint("0.7");
const publicClient = createPublicClient({
  chain,
  transport: http(),
});

export const Zerodev = () => {
  const { wallets } = useWallets();
  const [loading, setLoading] = useState(false);
  const [sendingTx, setSendingTx] = useState(false);
  const [amount, setAmount] = useState<string>("");
  const [sessionKernelClient, setSessionKernelClient] = useState<KernelAccountClient | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("0");
  const [tokenName, setTokenName] = useState<string>("Token");

  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy"
  );

  const { signAuthorization } = useSignAuthorization();

  // Function to fetch token balance and name
  const fetchBalance = async () => {
    if (!embeddedWallet?.address) return;

    try {
      // Fetch balance and token name in parallel
      const [balance, name] = await Promise.all([
        publicClient.readContract({
          address: TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [embeddedWallet.address as `0x${string}`],
        }),
        publicClient.readContract({
          address: TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: 'name',
        })
      ]);

      // Convert balance from wei to readable format
      const formattedBalance = (Number(balance) / Math.pow(10, TOKEN_DECIMALS)).toFixed(6);
      setBalance(formattedBalance);
      setTokenName(name as string);
    } catch (error) {
      console.error("Failed to fetch balance:", error);
      setBalance("Error");
    }
  };

  // Effect to fetch balance every 5 seconds
  useEffect(() => {
    if (embeddedWallet?.address) {
      fetchBalance(); // Initial fetch

      const interval = setInterval(() => {
        fetchBalance();
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [embeddedWallet?.address]);

  const createSessionKey = async () => {
    if (!embeddedWallet) {
      console.error("❌ No embedded wallet found");
      alert(`No embedded wallet found. Available wallet types: ${wallets.map(w => w.walletClientType).join(', ')}. Please connect your wallet first.`);
      return;
    }

    if (!bundlerRpc || !paymasterRpc) {
      console.error("❌ Missing required environment variables");
      alert("Missing required environment variables. Check NEXT_PUBLIC_BUNDLER_RPC and NEXT_PUBLIC_PAYMASTER_RPC");
      return;
    }

    setLoading(true);

    try {
      const ethereumProvider = await embeddedWallet.getEthereumProvider();

      const walletClient = createWalletClient({
        // Use any Viem-compatible EOA account
        account: embeddedWallet.address as Hex,
        // We use the Sepolia here, but you can use any network that
        // supports EIP-7702.
        chain,
        transport: custom(ethereumProvider),
      });

      const authorization = await signAuthorization({
        contractAddress: KernelVersionToAddressesMap[kernelVersion].accountImplementationAddress,
        chainId: chain.id,
      });

      const kernelAccount = await createKernelAccount(publicClient, {
        eip7702Account: walletClient,
        entryPoint,
        kernelVersion,
        eip7702Auth: authorization,
      });

      const masterKernelAccountClient = createKernelAccountClient({
        account: kernelAccount,
        chain,
        bundlerTransport: http(bundlerRpc),
        paymaster: createZeroDevPaymasterClient({
          chain,
          transport: http(paymasterRpc),
        }),
        client: publicClient,
      });


      // Create Session Key ---------------
      const _sessionPrivateKey = generatePrivateKey();

      const sessionAccount = privateKeyToAccount(_sessionPrivateKey as `0x${string}`);

      const sessionKeySigner = await toECDSASigner({
        signer: sessionAccount,
      });

      const callPolicy = toCallPolicy({
        policyVersion: CallPolicyVersion.V0_0_4,
        permissions: [
          {
            target: TOKEN_ADDRESS,
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
        entryPoint: entryPoint,
        kernelVersion: kernelVersion,
        signer: sessionKeySigner,
        policies: [callPolicy],
      });

      const sessionKeyKernelAccount = await createKernelAccount(publicClient, {
        entryPoint,
        eip7702Account: walletClient,
        plugins: {
          regular: permissionPlugin,
        },
        kernelVersion: kernelVersion,
        address: masterKernelAccountClient.account.address,
      });

      const sessionKeyKernelAccountClient = createKernelAccountClient({
        account: sessionKeyKernelAccount,
        chain,
        bundlerTransport: http(bundlerRpc),
        paymaster: {
          getPaymasterData(userOperation) {
            return createZeroDevPaymasterClient({
              chain,
              transport: http(paymasterRpc),
            }).sponsorUserOperation({ userOperation });
          },
        },
      });

      setSessionKernelClient(sessionKeyKernelAccountClient);

      console.log("✅ Session key created successfully");
    } catch (e) {
      console.error("❌ createSessionKey failed:", e);
      const error = e as any;

      // Show user-friendly error message
      let errorMessage = "createSessionKey failed. ";
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

  const sendTransactionWithAmount = async () => {
    if (!sessionKernelClient) {
      alert("Please create a session key first");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setSendingTx(true);
    setTxHash(null);

    try {
      const hash = await sessionKernelClient.sendTransaction({
        calls: [
          {
            to: TOKEN_ADDRESS,
            value: BigInt(0),
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: "transfer",
              args: [RECEIVER, parseUnits(amount, TOKEN_DECIMALS)],
            }),
          },
        ],
      });

      setTxHash(hash);
      console.log("✅ Transaction sent successfully:", hash);
      alert(`Transaction sent successfully! Hash: ${hash}`);
    } catch (e) {
      console.error("❌ sendTransactionWithAmount failed:", e);
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
    <>
      <p className="mt-6 font-bold uppercase text-sm text-gray-600">
        Zerodev Delegation + Flow
      </p>

      {/* Wallet Info Section */}
      {embeddedWallet && (
        <div className="mt-4 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 shadow-sm">
          <div className="flex items-center mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <h3 className="text-lg font-bold text-gray-800">Privy Wallet</h3>
          </div>

          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">钱包地址</span>
                <button
                  onClick={() => navigator.clipboard.writeText(embeddedWallet.address)}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  复制
                </button>
              </div>
              <div className="font-mono text-sm text-gray-800 bg-gray-50 p-2 rounded border break-all">
                {embeddedWallet.address}
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600">{tokenName} 余额</span>
                <span className="text-lg font-bold text-blue-600">
                  {balance} {tokenName}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex gap-4 flex-wrap">
        <button
          onClick={createSessionKey}
          disabled={loading}
          className="flex items-center px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-400 text-white font-medium rounded-lg shadow-sm transition-colors duration-200"
        >
          {loading && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
          )}
          {loading ? "创建中..." : "创建 Session Key"}
        </button>
      </div>

      {sessionKernelClient && (
        <div className="mt-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 shadow-sm">
          <div className="flex items-center mb-4">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <p className="text-lg font-bold text-green-700">Session Key 创建成功！</p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-3">发送 Token 交易</h4>
            <div className="flex gap-3 items-center">
              <input
                type="text"
                placeholder="输入转账金额"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                disabled={sendingTx}
              />
              <button
                onClick={sendTransactionWithAmount}
                disabled={sendingTx || !amount}
                className="flex items-center px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg shadow-sm transition-colors duration-200"
              >
                {sendingTx && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                )}
                {sendingTx ? "发送中..." : "发送交易"}
              </button>
            </div>
          </div>
        </div>
      )}

      {txHash && (
        <div className="mt-6 p-6 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-200 shadow-sm">
          <div className="flex items-center mb-4">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center mr-3">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-green-700">交易发送成功！</h3>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">交易哈希</span>
              <button
                onClick={() => navigator.clipboard.writeText(txHash)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                复制
              </button>
            </div>
            <div className="font-mono text-sm text-gray-800 bg-gray-50 p-2 rounded border break-all mb-3">
              {txHash}
            </div>
            <a
              href={`${chain.blockExplorers?.default?.url}/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors duration-200"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              在区块链浏览器中查看
            </a>
          </div>
        </div>
      )}
    </>
  );
};
