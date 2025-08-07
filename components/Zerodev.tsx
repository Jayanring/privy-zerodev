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
  KernelAccountClient,
} from "@zerodev/sdk";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { useSignAuthorization, useWallets } from "@privy-io/react-auth";
import { useState } from "react";
import { toECDSASigner } from "@zerodev/permissions/signers";
import { CallPolicyVersion, ParamCondition, toCallPolicy } from "@zerodev/permissions/policies";
import { erc20Abi, parseUnits } from "viem";
import { toPermissionValidator } from "@zerodev/permissions";

const bundlerRpc = process.env.NEXT_PUBLIC_BUNDLER_RPC;

const paymasterRpc = process.env.NEXT_PUBLIC_PAYMASTER_RPC;

const TOKEN_ADDRESS = "0xB763277E5139fB8Ac694Fb9ef14489ec5092750c";
const TOKEN_DECIMALS = 6;

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
  const [sessionKernelClient, setSessionKernelClient] = useState<KernelAccountClient | null>(null);

  const embeddedWallet = wallets.find(
    (wallet) => wallet.walletClientType === "privy"
  );

  const { signAuthorization } = useSignAuthorization();

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

      const ecdsaValidator = await signerToEcdsaValidator(
        publicClient,
        {
          signer: walletClient,
          entryPoint,
          kernelVersion,
        }
      );

      const kernelAccount = await createKernelAccount(publicClient, {
        plugins: {
          sudo: ecdsaValidator,
        },
        address: walletClient.account.address,
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
                condition: ParamCondition.LESS_THAN_OR_EQUAL,
                value: parseUnits("10", TOKEN_DECIMALS),
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

  return (
    <>
      <p className="mt-6 font-bold uppercase text-sm text-gray-600">
        Zerodev Delegation + Flow
      </p>
      <div className="mt-2 flex gap-4 flex-wrap">
        <button
          onClick={createSessionKey}
          disabled={loading}
          className="text-sm bg-violet-600 hover:bg-violet-700 py-2 px-4 rounded-md text-white border-none"
        >
          createSessionKey
        </button>
      </div>
      {/* {!!txHash && (
        <a href={`${chain.blockExplorers.default.url}/tx/${txHash}`}>
          Success! View transaction
        </a>
      )} */}
    </>
  );
};
