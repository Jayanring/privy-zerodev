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
  KERNEL_V3_3,
  KernelVersionToAddressesMap,
} from "@zerodev/sdk/constants";
import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
} from "@zerodev/sdk";
import { sepolia } from "viem/chains";
import { useSign7702Authorization, useWallets } from "@privy-io/react-auth";
import { useState } from "react";

const bundlerRpc = process.env.NEXT_PUBLIC_BUNDLER_RPC;

const paymasterRpc = process.env.NEXT_PUBLIC_PAYMASTER_RPC;

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
  const [txHash, setTxHash] = useState<string | null>(null);

  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy"
  );

  const { signAuthorization } = useSign7702Authorization();

  return (
    <>
      <p className="mt-6 font-bold uppercase text-sm text-gray-600">
        Zerodev Delegation + Flow
      </p>
      <div className="mt-2 flex gap-4 flex-wrap">
        <button
          onClick={async () => {
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

              const authParams = {
                contractAddress:
                  KernelVersionToAddressesMap[kernelVersion]
                    .accountImplementationAddress,
                sponsor: true,
                chainId: chain.id,
              };

              const authorization = await signAuthorization(authParams);

              const ecdsaValidator = await signerToEcdsaValidator(
                publicClient,
                {
                  signer: walletClient,
                  entryPoint,
                  kernelVersion,
                }
              );

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

              const account = await createKernelAccount(publicClient, accountParams);

              const paymasterClient = createZeroDevPaymasterClient({
                chain,
                transport: http(paymasterRpc),
              });

              const kernelClient = createKernelAccountClient({
                account,
                chain,
                bundlerTransport: http(bundlerRpc),
                paymaster: paymasterClient,
                client: publicClient,
              });
            } catch (e) {
              console.error("❌ Transaction failed:", e);
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
              setLoading(false);
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
