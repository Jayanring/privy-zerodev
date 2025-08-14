"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toRateLimitPolicy = void 0;
const viem_1 = require("viem");
const constants_js_1 = require("../constants.js");
const constants_js_2 = require("../constants.js");
function toRateLimitPolicy({ policyAddress = constants_js_2.RATE_LIMIT_POLICY_CONTRACT, policyFlag = constants_js_1.PolicyFlags.FOR_ALL_VALIDATION, interval = 0, count, startAt = 0 }) {
    return {
        getPolicyData: () => {
            if (policyAddress === constants_js_2.RATE_LIMIT_POLICY_CONTRACT) {
                const intervalHex = interval.toString(16).padStart(12, "0");
                const countHex = count.toString(16).padStart(12, "0");
                const startAtHex = startAt.toString(16).padStart(12, "0");
                const data = intervalHex + countHex + startAtHex;
                return `0x${data}`;
            }
            else if (policyAddress === constants_js_2.RATE_LIMIT_POLICY_WITH_RESET_CONTRACT) {
                if (startAt !== 0 && startAt !== undefined) {
                    throw new Error("RATE_LIMIT_POLICY_WITH_RESET_CONTRACT does not support startAt");
                }
                const intervalHex = interval.toString(16).padStart(12, "0");
                const countHex = count.toString(16).padStart(12, "0");
                const data = intervalHex + countHex;
                return `0x${data}`;
            }
            else {
                throw new Error("Invalid policy address");
            }
        },
        getPolicyInfoInBytes: () => {
            return (0, viem_1.concatHex)([policyFlag, policyAddress]);
        },
        policyParams: {
            type: "rate-limit",
            policyAddress,
            policyFlag,
            interval,
            count,
            startAt
        }
    };
}
exports.toRateLimitPolicy = toRateLimitPolicy;
//# sourceMappingURL=toRateLimitPolicy.js.map