import { concatHex, encodeAbiParameters } from "viem";
import { PolicyFlags } from "../constants.js";
import { SIGNATURE_POLICY_CONTRACT } from "../constants.js";
export function toSignatureCallerPolicy({ policyAddress = SIGNATURE_POLICY_CONTRACT, policyFlag = PolicyFlags.FOR_ALL_VALIDATION, allowedCallers }) {
    return {
        getPolicyData: () => {
            return encodeAbiParameters([{ name: "allowedCallers", type: "address[]" }], [allowedCallers]);
        },
        getPolicyInfoInBytes: () => {
            return concatHex([policyFlag, policyAddress]);
        },
        policyParams: {
            type: "signature-caller",
            policyAddress,
            policyFlag,
            allowedCallers
        }
    };
}
//# sourceMappingURL=toSignatureCallerPolicy.js.map