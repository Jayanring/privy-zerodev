import { concatHex, pad } from "viem";
import { CALL_POLICY_CONTRACT_V0_0_1, CALL_POLICY_CONTRACT_V0_0_2, CALL_POLICY_CONTRACT_V0_0_3, CALL_POLICY_CONTRACT_V0_0_4, PolicyFlags } from "../constants.js";
import { encodePermissionData, getPermissionFromABI } from "./callPolicyUtils.js";
import { CallType } from "./types.js";
export var CallPolicyVersion;
(function (CallPolicyVersion) {
    CallPolicyVersion["V0_0_1"] = "0.0.1";
    CallPolicyVersion["V0_0_2"] = "0.0.2";
    CallPolicyVersion["V0_0_3"] = "0.0.3";
    CallPolicyVersion["V0_0_4"] = "0.0.4";
})(CallPolicyVersion || (CallPolicyVersion = {}));
export const getCallPolicyAddress = (policyVersion, policyAddress) => {
    if (policyAddress)
        return policyAddress;
    switch (policyVersion) {
        case CallPolicyVersion.V0_0_1:
            return CALL_POLICY_CONTRACT_V0_0_1;
        case CallPolicyVersion.V0_0_2:
            return CALL_POLICY_CONTRACT_V0_0_2;
        case CallPolicyVersion.V0_0_3:
            return CALL_POLICY_CONTRACT_V0_0_3;
        case CallPolicyVersion.V0_0_4:
            return CALL_POLICY_CONTRACT_V0_0_4;
    }
};
export function toCallPolicy({ policyAddress, policyFlag = PolicyFlags.FOR_ALL_VALIDATION, policyVersion, permissions = [] }) {
    const callPolicyAddress = getCallPolicyAddress(policyVersion, policyAddress);
    const generatedPermissionParams = permissions?.map((perm) => {
        // Natural discrimination: if abi and functionName are present, do ABI-based validation
        if (perm.abi && perm.functionName) {
            return getPermissionFromABI({
                abi: perm.abi,
                functionName: perm.functionName,
                args: perm.args,
                policyAddress: callPolicyAddress,
                selector: perm.selector
            });
        }
        // Otherwise, this is a manual permission - return empty to use manual selector/rules
        return {
            selector: undefined,
            rules: undefined
        };
    });
    permissions =
        permissions?.map((perm, index) => ({
            ...perm,
            callType: perm.callType ?? CallType.CALL,
            selector: 
            // Normalize selector to lowercase if it exists (hex values should be lowercase)
            (perm.selector
                ? perm.selector.toLowerCase()
                : perm.selector) ??
                generatedPermissionParams?.[index]?.selector ??
                pad("0x", { size: 4 }),
            valueLimit: perm.valueLimit ?? 0n,
            rules: perm.rules ?? generatedPermissionParams?.[index]?.rules ?? []
        })) ?? [];
    const encodedPermissionData = encodePermissionData(permissions, callPolicyAddress);
    return {
        getPolicyData: () => {
            return encodedPermissionData;
        },
        getPolicyInfoInBytes: () => {
            return concatHex([policyFlag, callPolicyAddress]);
        },
        policyParams: {
            type: "call",
            policyVersion,
            policyAddress,
            policyFlag,
            permissions
        }
    };
}
//# sourceMappingURL=toCallPolicy.js.map