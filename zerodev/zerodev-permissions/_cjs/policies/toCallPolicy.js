"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCallPolicy = exports.getCallPolicyAddress = exports.CallPolicyVersion = void 0;
const viem_1 = require("viem");
const constants_js_1 = require("../constants.js");
const callPolicyUtils_js_1 = require("./callPolicyUtils.js");
const types_js_1 = require("./types.js");
var CallPolicyVersion;
(function (CallPolicyVersion) {
    CallPolicyVersion["V0_0_1"] = "0.0.1";
    CallPolicyVersion["V0_0_2"] = "0.0.2";
    CallPolicyVersion["V0_0_3"] = "0.0.3";
    CallPolicyVersion["V0_0_4"] = "0.0.4";
})(CallPolicyVersion || (exports.CallPolicyVersion = CallPolicyVersion = {}));
const getCallPolicyAddress = (policyVersion, policyAddress) => {
    if (policyAddress)
        return policyAddress;
    switch (policyVersion) {
        case CallPolicyVersion.V0_0_1:
            return constants_js_1.CALL_POLICY_CONTRACT_V0_0_1;
        case CallPolicyVersion.V0_0_2:
            return constants_js_1.CALL_POLICY_CONTRACT_V0_0_2;
        case CallPolicyVersion.V0_0_3:
            return constants_js_1.CALL_POLICY_CONTRACT_V0_0_3;
        case CallPolicyVersion.V0_0_4:
            return constants_js_1.CALL_POLICY_CONTRACT_V0_0_4;
    }
};
exports.getCallPolicyAddress = getCallPolicyAddress;
function toCallPolicy({ policyAddress, policyFlag = constants_js_1.PolicyFlags.FOR_ALL_VALIDATION, policyVersion, permissions = [] }) {
    const callPolicyAddress = (0, exports.getCallPolicyAddress)(policyVersion, policyAddress);
    const generatedPermissionParams = permissions?.map((perm) => {
        if (perm.abi && perm.functionName) {
            return (0, callPolicyUtils_js_1.getPermissionFromABI)({
                abi: perm.abi,
                functionName: perm.functionName,
                args: perm.args,
                policyAddress: callPolicyAddress,
                selector: perm.selector
            });
        }
        return {
            selector: undefined,
            rules: undefined
        };
    });
    permissions =
        permissions?.map((perm, index) => ({
            ...perm,
            callType: perm.callType ?? types_js_1.CallType.CALL,
            selector: (perm.selector
                ? perm.selector.toLowerCase()
                : perm.selector) ??
                generatedPermissionParams?.[index]?.selector ??
                (0, viem_1.pad)("0x", { size: 4 }),
            valueLimit: perm.valueLimit ?? 0n,
            rules: perm.rules ?? generatedPermissionParams?.[index]?.rules ?? []
        })) ?? [];
    const encodedPermissionData = (0, callPolicyUtils_js_1.encodePermissionData)(permissions, callPolicyAddress);
    return {
        getPolicyData: () => {
            return encodedPermissionData;
        },
        getPolicyInfoInBytes: () => {
            return (0, viem_1.concatHex)([policyFlag, callPolicyAddress]);
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
exports.toCallPolicy = toCallPolicy;
//# sourceMappingURL=toCallPolicy.js.map