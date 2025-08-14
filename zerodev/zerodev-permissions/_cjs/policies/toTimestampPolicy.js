"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toTimestampPolicy = void 0;
const viem_1 = require("viem");
const constants_js_1 = require("../constants.js");
function toTimestampPolicy({ policyAddress = constants_js_1.TIMESTAMP_POLICY_CONTRACT, policyFlag = constants_js_1.PolicyFlags.FOR_ALL_VALIDATION, validAfter = 0, validUntil = 0 }) {
    return {
        getPolicyData: () => {
            return (0, viem_1.encodeAbiParameters)([
                { name: "validAfter", type: "uint48" },
                { name: "validUntil", type: "uint48" }
            ], [validAfter, validUntil]);
        },
        getPolicyInfoInBytes: () => {
            return (0, viem_1.concatHex)([policyFlag, policyAddress]);
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
exports.toTimestampPolicy = toTimestampPolicy;
//# sourceMappingURL=toTimestampPolicy.js.map