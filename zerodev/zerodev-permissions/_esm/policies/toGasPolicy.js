import { concatHex, encodeAbiParameters, zeroAddress } from "viem";
import { PolicyFlags } from "../constants.js";
import { GAS_POLICY_CONTRACT } from "../constants.js";
export function toGasPolicy({ policyAddress = GAS_POLICY_CONTRACT, policyFlag = PolicyFlags.FOR_ALL_VALIDATION, allowed = 0n, enforcePaymaster = false, allowedPaymaster = zeroAddress }) {
    return {
        getPolicyData: () => {
            return encodeAbiParameters([
                { name: "allowed", type: "uint128" },
                { name: "enforcePaymaster", type: "bool" },
                { name: "allowedPaymaster", type: "address" }
            ], [allowed, enforcePaymaster, allowedPaymaster]);
        },
        getPolicyInfoInBytes: () => {
            return concatHex([policyFlag, policyAddress]);
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
//# sourceMappingURL=toGasPolicy.js.map