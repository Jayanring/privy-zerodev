import { concat, encodeAbiParameters } from "viem";
export const toSignerId = (signer) => {
    return encodeAbiParameters([{ name: "signerData", type: "bytes" }], [concat([signer.signerContractAddress, signer.getSignerData()])]);
};
//# sourceMappingURL=toSignerId.js.map