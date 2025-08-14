"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSignatureCallerPolicy = void 0;
const viem_1 = require("viem");
const constants_js_1 = require("../constants.js");
const constants_js_2 = require("../constants.js");
function toSignatureCallerPolicy({ policyAddress = constants_js_2.SIGNATURE_POLICY_CONTRACT, policyFlag = constants_js_1.PolicyFlags.FOR_ALL_VALIDATION, allowedCallers }) {
    return {
        getPolicyData: () => {
            return (0, viem_1.encodeAbiParameters)([{ name: "allowedCallers", type: "address[]" }], [allowedCallers]);
        },
        getPolicyInfoInBytes: () => {
            return (0, viem_1.concatHex)([policyFlag, policyAddress]);
        },
        policyParams: {
            type: "signature-caller",
            policyAddress,
            policyFlag,
            allowedCallers
        }
    };
}
exports.toSignatureCallerPolicy = toSignatureCallerPolicy;
//# sourceMappingURL=toSignatureCallerPolicy.js.map