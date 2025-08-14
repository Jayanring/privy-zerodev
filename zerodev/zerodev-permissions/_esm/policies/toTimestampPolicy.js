import { concatHex, encodeAbiParameters } from "viem";
import { PolicyFlags, TIMESTAMP_POLICY_CONTRACT } from "../constants.js";
export function toTimestampPolicy({ policyAddress = TIMESTAMP_POLICY_CONTRACT, policyFlag = PolicyFlags.FOR_ALL_VALIDATION, validAfter = 0, validUntil = 0 }) {
    return {
        getPolicyData: () => {
            return encodeAbiParameters([
                { name: "validAfter", type: "uint48" },
                { name: "validUntil", type: "uint48" }
            ], [validAfter, validUntil]);
        },
        getPolicyInfoInBytes: () => {
            return concatHex([policyFlag, policyAddress]);
        },
        policyParams: {
            type: "timestamp",
            policyAddress,
            policyFlag,
            validAfter,
            validUntil
        }
    };
}
//# sourceMappingURL=toTimestampPolicy.js.map