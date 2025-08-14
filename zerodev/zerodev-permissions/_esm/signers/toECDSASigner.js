import { constants, fixSignedData, toSigner } from "@zerodev/sdk";
import { toAccount } from "viem/accounts";
import { ECDSA_SIGNER_CONTRACT } from "../constants.js";
export async function toECDSASigner({ signer, signerContractAddress = ECDSA_SIGNER_CONTRACT }) {
    const viemSigner = await toSigner({ signer });
    const account = toAccount({
        address: viemSigner.address,
        async signMessage({ message }) {
            return fixSignedData(await viemSigner.signMessage({ message }));
        },
        async signTransaction(_, __) {
            throw new Error("Smart account signer doesn't need to sign transactions");
        },
        async signTypedData(typedData) {
            return fixSignedData(await viemSigner.signTypedData({
                ...typedData
            }));
        }
    });
    return {
        account,
        signerContractAddress,
        getSignerData: () => {
            return viemSigner.address;
        },
        getDummySignature: () => constants.DUMMY_ECDSA_SIG
    };
}
//# sourceMappingURL=toECDSASigner.js.map