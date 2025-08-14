"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodePermissionData = exports.getPermissionFromABI = void 0;
const viem_1 = require("viem");
const constants_js_1 = require("../constants.js");
const types_js_1 = require("./types.js");
function getPermissionFromABI({ abi, args, functionName, policyAddress, selector }) {
    if (!abi || !functionName) {
        return {
            selector: undefined,
            rules: undefined
        };
    }
    const matchingFunctions = abi.filter((item) => item.type === "function" && item.name === functionName);
    let targetFunction;
    if (matchingFunctions.length > 1) {
        if (selector) {
            const normalizedSelector = selector.toLowerCase();
            const foundFunction = matchingFunctions.find((fn) => {
                const functionSelector = (0, viem_1.toFunctionSelector)(fn);
                return functionSelector === normalizedSelector;
            });
            if (!foundFunction) {
                throw new Error(`No function found with selector "${selector}" for function "${functionName}".`);
            }
            targetFunction = foundFunction;
        }
        else {
            const functionSignatures = matchingFunctions
                .map((fn, index) => {
                const inputs = fn.inputs
                    ?.map((input) => input.name
                    ? `${input.type} ${input.name}`
                    : input.type)
                    .join(", ") || "";
                return `  ${index + 1}. ${functionName}(${inputs})`;
            })
                .join("\n");
            throw new Error(`Multiple function overloads found for "${functionName}". Found ${matchingFunctions.length} functions with the same name but different signatures. To avoid ambiguity and potential security issues, please provide a "selector" field to specify which overload you want to use, or filter your ABI to include only the specific function overload you intend to use.

                Matching functions:
                ${functionSignatures}

                Solution: Either add a "selector" field with the specific function selector, or filter your ABI to include only the specific function signature you want to use.`);
        }
    }
    else if (matchingFunctions.length === 1) {
        targetFunction = matchingFunctions[0];
    }
    else {
        throw new Error(`Function "${functionName}" not found in ABI`);
    }
    const functionSelector = (0, viem_1.toFunctionSelector)(targetFunction);
    let paramRules = [];
    if (args && Array.isArray(args)) {
        paramRules = args
            .map((arg, i) => {
            if (!arg)
                return null;
            if (policyAddress === constants_js_1.CALL_POLICY_CONTRACT_V0_0_1) {
                if (arg.condition === types_js_1.ParamCondition.ONE_OF) {
                    throw Error("The ONE_OF condition is only supported from CALL_POLICY_CONTRACT_V0_0_2 onwards. Please use CALL_POLICY_CONTRACT_V0_0_2 or a later version.");
                }
                return {
                    params: (0, viem_1.pad)((0, viem_1.isHex)(arg.value)
                        ? arg.value
                        : (0, viem_1.toHex)(arg.value), { size: 32 }),
                    offset: i * 32,
                    condition: arg.condition
                };
            }
            let params;
            if (arg.condition === types_js_1.ParamCondition.ONE_OF) {
                params = arg.value.map((value) => (0, viem_1.pad)((0, viem_1.isHex)(value)
                    ? value
                    : (0, viem_1.toHex)(value), { size: 32 }));
            }
            else {
                params = [
                    (0, viem_1.pad)((0, viem_1.isHex)(arg.value)
                        ? arg.value
                        : (0, viem_1.toHex)(arg.value), { size: 32 })
                ];
            }
            return {
                params,
                offset: i * 32,
                condition: arg.condition
            };
        })
            .filter((rule) => rule);
    }
    return {
        selector: functionSelector,
        rules: paramRules
    };
}
exports.getPermissionFromABI = getPermissionFromABI;
const encodePermissionData = (permission, policyAddress) => {
    const permissionParam = {
        components: [
            {
                internalType: "enum CallType",
                name: "callType",
                type: "bytes1"
            },
            {
                name: "target",
                type: "address"
            },
            {
                name: "selector",
                type: "bytes4"
            },
            {
                name: "valueLimit",
                type: "uint256"
            },
            {
                components: [
                    {
                        internalType: "enum ParamCondition",
                        name: "condition",
                        type: "uint8"
                    },
                    {
                        name: "offset",
                        type: "uint64"
                    },
                    {
                        name: "params",
                        type: policyAddress === constants_js_1.CALL_POLICY_CONTRACT_V0_0_1
                            ? "bytes32"
                            : "bytes32[]"
                    }
                ],
                name: "rules",
                type: "tuple[]"
            }
        ],
        name: "permission",
        type: "tuple[]"
    };
    const params = [permissionParam];
    const values = [permission];
    return (0, viem_1.encodeAbiParameters)(params, values);
};
exports.encodePermissionData = encodePermissionData;
//# sourceMappingURL=callPolicyUtils.js.map