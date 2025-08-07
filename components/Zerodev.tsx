import {
  createPublicClient,
  createWalletClient,
  custom,
  Hex,
  http,
  zeroAddress,
} from "viem";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import {
  getEntryPoint,
  KERNEL_V3_3_BETA,
  KernelVersionToAddressesMap,
} from "@zerodev/sdk/constants";
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from "@zerodev/sdk";
import { sepolia } from "viem/chains";
import { useSignAuthorization, useWallets } from "@privy-io/react-auth";
import { useState } from "react";

const bundlerRpc = process.env.NEXT_PUBLIC_BUNDLER_RPC;

const paymasterRpc = process.env.NEXT_PUBLIC_PAYMASTER_RPC;

const chain = sepolia;
const kernelVersion = KERNEL_V3_3_BETA;
const entryPoint = getEntryPoint("0.7");
const publicClient = createPublicClient({
  chain,
  transport: http(),
});

export const Zerodev = () => {
  const { wallets } = useWallets();
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Debug: Print all wallet information
  console.log("🔍 All wallets debug info:", {
    totalWallets: wallets.length,
    wallets: wallets.map((wallet, index) => ({
      index,
      address: wallet.address,
      walletClientType: wallet.walletClientType,
      connectorType: wallet.connectorType,
      imported: wallet.imported,
      type: typeof wallet,
      keys: Object.keys(wallet),
      fullWallet: wallet // Print the entire wallet object to see all properties
    }))
  });

  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy"
  );

  console.log("🔍 Embedded wallet search result:", {
    found: !!embeddedWallet,
    embeddedWallet: embeddedWallet ? {
      address: embeddedWallet.address,
      walletClientType: embeddedWallet.walletClientType,
      connectorType: embeddedWallet.connectorType
    } : null
  });

  const { signAuthorization } = useSignAuthorization();

  return (
    <>
      <p className="mt-6 font-bold uppercase text-sm text-gray-600">
        Zerodev Delegation + Flow
      </p>
      <div className="mt-2 flex gap-4 flex-wrap">
        <button
          onClick={async () => {
            console.log("🚀 Delegate & Send Transaction button clicked");

            // Debug: Print current wallet state at button click
            console.log("🔍 Button click wallet debug:", {
              totalWallets: wallets.length,
              embeddedWalletFound: !!embeddedWallet,
              walletTypes: wallets.map(w => ({
                address: w.address,
                walletClientType: w.walletClientType,
                connectorType: w.connectorType
              })),
              searchingFor: "walletClientType === 'privy'"
            });

            if (!embeddedWallet) {
              console.error("❌ No embedded wallet found");
              console.error("Available wallet types:", wallets.map(w => w.walletClientType));

              // Try to find any wallet that might work
              const anyWallet = wallets[0];
              if (anyWallet) {
                console.log("🔍 First available wallet:", {
                  address: anyWallet.address,
                  walletClientType: anyWallet.walletClientType,
                  connectorType: anyWallet.connectorType
                });
              }

              alert(`No embedded wallet found. Available wallet types: ${wallets.map(w => w.walletClientType).join(', ')}. Please connect your wallet first.`);
              return;
            }

            console.log("✅ Embedded wallet found:", {
              address: embeddedWallet.address,
              walletClientType: embeddedWallet.walletClientType
            });

            // Check environment variables
            console.log("🔧 Environment check:", {
              bundlerRpc: bundlerRpc ? "✅ Set" : "❌ Missing",
              paymasterRpc: paymasterRpc ? "✅ Set" : "❌ Missing",
              bundlerRpcValue: bundlerRpc,
              paymasterRpcValue: paymasterRpc
            });

            if (!bundlerRpc || !paymasterRpc) {
              console.error("❌ Missing required environment variables");
              alert("Missing required environment variables. Check NEXT_PUBLIC_BUNDLER_RPC and NEXT_PUBLIC_PAYMASTER_RPC");
              return;
            }

            setLoading(true);
            console.log("⏳ Starting transaction process...");

            try {
              console.log("📝 Step 1: Creating wallet client...");
              const ethereumProvider = await embeddedWallet.getEthereumProvider();
              console.log("✅ Ethereum provider obtained:", !!ethereumProvider);

              const walletClient = createWalletClient({
                // Use any Viem-compatible EOA account
                account: embeddedWallet.address as Hex,
                // We use the Sepolia here, but you can use any network that
                // supports EIP-7702.
                chain,
                transport: custom(ethereumProvider),
              });
              console.log("✅ Wallet client created:", {
                account: walletClient.account?.address,
                chain: walletClient.chain?.name
              });

              console.log("📝 Step 2: Signing authorization...");
              const authParams = {
                contractAddress:
                  KernelVersionToAddressesMap[kernelVersion]
                    .accountImplementationAddress,
                sponsor: true,
                chainId: chain.id,
              };
              console.log("🔧 Authorization parameters:", authParams);

              const authorization = await signAuthorization(authParams);
              console.log("✅ Authorization signed:", {
                authorizationExists: !!authorization,
                authorizationType: typeof authorization
              });

              console.log("📝 Step 3: Creating ECDSA validator...");
              const ecdsaValidator = await signerToEcdsaValidator(
                publicClient,
                {
                  signer: walletClient,
                  entryPoint,
                  kernelVersion,
                }
              );
              console.log("✅ ECDSA validator created:", !!ecdsaValidator);

              console.log("📝 Step 4: Creating kernel account...");
              const accountParams = {
                plugins: {
                  sudo: ecdsaValidator,
                },
                entryPoint,
                kernelVersion,
                // Set the address of the smart account to the EOA address
                address: walletClient.account.address,
                // Set the 7702 authorization
                eip7702Auth: authorization,
              };
              console.log("🔧 Account parameters:", {
                ...accountParams,
                eip7702Auth: !!authorization
              });

              const account = await createKernelAccount(publicClient, accountParams);
              console.log("✅ Kernel account created:", {
                address: account.address,
                type: account.type
              });

              console.log("📝 Step 5: Creating paymaster client...");
              const paymasterClient = createZeroDevPaymasterClient({
                chain,
                transport: http(paymasterRpc),
              });
              console.log("✅ Paymaster client created");

              console.log("📝 Step 6: Creating kernel account client...");
              const kernelClient = createKernelAccountClient({
                account,
                chain,
                bundlerTransport: http(bundlerRpc),
                paymaster: paymasterClient,
                client: publicClient,
              });
              console.log("✅ Kernel account client created");

              console.log("📝 Step 7: Sending user operation...");
              const userOpParams = {
                calls: [{ to: zeroAddress, value: BigInt(0), data: "0x0123456789abcdef" as Hex }],
              };
              console.log("🔧 User operation parameters:", userOpParams);

              const userOpHash = await kernelClient.sendUserOperation(userOpParams);
              console.log("✅ User operation sent:", {
                hash: userOpHash,
                hashLength: userOpHash?.length
              });

              console.log("📝 Step 8: Waiting for receipt...");
              const { receipt } =
                await kernelClient.waitForUserOperationReceipt({
                  hash: userOpHash,
                });
              console.log("✅ Receipt received:", {
                transactionHash: receipt.transactionHash,
                status: receipt.status,
                blockNumber: receipt.blockNumber
              });

              setTxHash(receipt.transactionHash);
              console.log("🎉 Transaction completed successfully!");

            } catch (e) {
              console.error("❌ Transaction failed:", e);
              const error = e as any;
              console.error("Error details:", {
                name: error?.name,
                message: error?.message,
                code: error?.code,
                stack: error?.stack
              });

              // Show user-friendly error message
              let errorMessage = "Transaction failed. ";
              if (error?.message) {
                errorMessage += `Error: ${error.message}`;
              } else {
                errorMessage += "Please check the console for details.";
              }
              alert(errorMessage);

            } finally {
              setLoading(false);
              console.log("🏁 Transaction process completed");
            }
          }}
          disabled={loading}
          className="text-sm bg-violet-600 hover:bg-violet-700 py-2 px-4 rounded-md text-white border-none"
        >
          Delegate & Send Transaction
        </button>
      </div>
      {!!txHash && (
        <a href={`${chain.blockExplorers.default.url}/tx/${txHash}`}>
          Success! View transaction
        </a>
      )}
    </>
  );
};
