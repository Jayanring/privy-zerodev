"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSudoPolicy = void 0;
const viem_1 = require("viem");
const constants_js_1 = require("../constants.js");
function toSudoPolicy({ policyAddress = constants_js_1.SUDO_POLICY_CONTRACT, policyFlag = constants_js_1.PolicyFlags.FOR_ALL_VALIDATION }) {
    return {
        getPolicyData: () => {
            return "0x";
        },
        getPolicyInfoInBytes: () => {
            return (0, viem_1.concatHex)([policyFlag, policyAddress]);
        },
        policyParams: {
            type: "sudo",
            policyAddress,
            policyFlag
        }
    };
}
exports.toSudoPolicy = toSudoPolicy;
//# sourceMappingURL=toSudoPolicy.js.map