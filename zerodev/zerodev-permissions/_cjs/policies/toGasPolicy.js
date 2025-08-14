"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toGasPolicy = void 0;
const viem_1 = require("viem");
const constants_js_1 = require("../constants.js");
const constants_js_2 = require("../constants.js");
function toGasPolicy({ policyAddress = constants_js_2.GAS_POLICY_CONTRACT, policyFlag = constants_js_1.PolicyFlags.FOR_ALL_VALIDATION, allowed = 0n, enforcePaymaster = false, allowedPaymaster = viem_1.zeroAddress }) {
    return {
        getPolicyData: () => {
            return (0, viem_1.encodeAbiParameters)([
                { name: "allowed", type: "uint128" },
                { name: "enforcePaymaster", type: "bool" },
                { name: "allowedPaymaster", type: "address" }
            ], [allowed, enforcePaymaster, allowedPaymaster]);
        },
        getPolicyInfoInBytes: () => {
            return (0, viem_1.concatHex)([policyFlag, policyAddress]);
        },
        policyParams: {
            type: "gas",
            policyAddress,
            policyFlag,
            allowed,
            enforcePaymaster,
            allowedPaymaster
        }
    };
}
exports.toGasPolicy = toGasPolicy;
//# sourceMappingURL=toGasPolicy.js.map