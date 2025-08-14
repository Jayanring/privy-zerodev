"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeParamsFromInitCode = exports.createPolicyFromParams = exports.deserializePermissionAccount = void 0;
const sdk_1 = require("@zerodev/sdk");
const accounts_1 = require("@zerodev/sdk/accounts");
const viem_1 = require("viem");
const accounts_2 = require("viem/accounts");
const index_js_1 = require("./policies/index.js");
const toECDSASigner_js_1 = require("./signers/toECDSASigner.js");
const toPermissionValidator_js_1 = require("./toPermissionValidator.js");
const utils_js_1 = require("./utils.js");
const utils_js_2 = require("./utils.js");
const deserializePermissionAccount = async (client, entryPoint, kernelVersion, modularPermissionAccountParams, modularSigner) => {
    if (entryPoint.version !== "0.7") {
        throw new Error("Only EntryPoint 0.7 is supported");
    }
    const params = (0, utils_js_1.deserializePermissionAccountParams)(modularPermissionAccountParams);
    let signer;
    if (params.privateKey)
        signer = await (0, toECDSASigner_js_1.toECDSASigner)({
            signer: (0, accounts_2.privateKeyToAccount)(params.privateKey)
        });
    else if (modularSigner)
        signer = modularSigner;
    else
        throw new Error("No signer or serialized sessionKey provided");
    const modularPermissionPlugin = await (0, toPermissionValidator_js_1.toPermissionValidator)(client, {
        signer,
        policies: await Promise.all(params.permissionParams.policies?.map((policy) => (0, exports.createPolicyFromParams)(policy)) || []),
        entryPoint,
        kernelVersion
    });
    const { index, validatorInitData, useMetaFactory } = (0, exports.decodeParamsFromInitCode)(params.accountParams.initCode, kernelVersion);
    const kernelPluginManager = await (0, accounts_1.toKernelPluginManager)(client, {
        regular: modularPermissionPlugin,
        pluginEnableSignature: params.isPreInstalled
            ? undefined
            : params.enableSignature,
        validatorInitData,
        action: params.action,
        entryPoint,
        kernelVersion,
        isPreInstalled: params.isPreInstalled,
        ...params.validityData
    });
    return (0, sdk_1.createKernelAccount)(client, {
        entryPoint,
        kernelVersion,
        plugins: kernelPluginManager,
        index,
        address: params.accountParams.accountAddress,
        useMetaFactory,
        eip7702Auth: params.eip7702Auth
    });
};
exports.deserializePermissionAccount = deserializePermissionAccount;
const createPolicyFromParams = async (policy) => {
    switch (policy.policyParams.type) {
        case "call":
            return await (0, index_js_1.toCallPolicy)(policy.policyParams);
        case "gas":
            return await (0, index_js_1.toGasPolicy)(policy.policyParams);
        case "rate-limit":
            return await (0, index_js_1.toRateLimitPolicy)(policy.policyParams);
        case "signature-caller":
            return await (0, index_js_1.toSignatureCallerPolicy)(policy.policyParams);
        case "sudo":
            return await (0, index_js_1.toSudoPolicy)(policy.policyParams);
        case "timestamp":
            return await (0, index_js_1.toTimestampPolicy)(policy.policyParams);
        default:
            throw new Error("Unsupported policy type");
    }
};
exports.createPolicyFromParams = createPolicyFromParams;
const decodeParamsFromInitCode = (initCode, kernelVersion) => {
    let index;
    let validatorInitData;
    let deployWithFactoryFunctionData;
    let useMetaFactory = true;
    if (initCode === "0x") {
        return {
            index: undefined,
            validatorInitData: undefined,
            useMetaFactory: true
        };
    }
    try {
        deployWithFactoryFunctionData = (0, viem_1.decodeFunctionData)({
            abi: sdk_1.KernelFactoryStakerAbi,
            data: initCode
        });
    }
    catch (error) {
        deployWithFactoryFunctionData = (0, viem_1.decodeFunctionData)({
            abi: sdk_1.KernelV3FactoryAbi,
            data: initCode
        });
        useMetaFactory = false;
    }
    if (!deployWithFactoryFunctionData)
        throw new Error("Invalid initCode");
    if (deployWithFactoryFunctionData.functionName === "deployWithFactory") {
        index = BigInt(deployWithFactoryFunctionData.args[2]);
        let initializeFunctionData;
        if (kernelVersion === "0.3.0") {
            initializeFunctionData = (0, viem_1.decodeFunctionData)({
                abi: sdk_1.KernelV3AccountAbi,
                data: deployWithFactoryFunctionData.args[1]
            });
        }
        else {
            initializeFunctionData = (0, viem_1.decodeFunctionData)({
                abi: sdk_1.KernelV3_1AccountAbi,
                data: deployWithFactoryFunctionData.args[1]
            });
        }
        if (!initializeFunctionData)
            throw new Error("Invalid initCode");
        if (initializeFunctionData.functionName === "initialize") {
            validatorInitData = {
                validatorAddress: initializeFunctionData.args[0],
                identifier: initializeFunctionData.args[0],
                enableData: initializeFunctionData.args[2],
                initConfig: (0, utils_js_2.isKernelVersionAfter)(kernelVersion, "0.3.1") &&
                    Array.isArray(initializeFunctionData.args[4])
                    ? [...initializeFunctionData.args[4]]
                    : undefined
            };
        }
    }
    else if (deployWithFactoryFunctionData.functionName === "createAccount") {
        index = BigInt(deployWithFactoryFunctionData.args[1]);
        let initializeFunctionData;
        if (kernelVersion === "0.3.0") {
            initializeFunctionData = (0, viem_1.decodeFunctionData)({
                abi: sdk_1.KernelV3AccountAbi,
                data: deployWithFactoryFunctionData.args[0]
            });
        }
        else {
            initializeFunctionData = (0, viem_1.decodeFunctionData)({
                abi: sdk_1.KernelV3_1AccountAbi,
                data: deployWithFactoryFunctionData.args[0]
            });
        }
        if (!initializeFunctionData)
            throw new Error("Invalid initCode");
        if (initializeFunctionData.functionName === "initialize") {
            validatorInitData = {
                validatorAddress: initializeFunctionData.args[0],
                identifier: initializeFunctionData.args[0],
                enableData: initializeFunctionData.args[2],
                initConfig: (0, utils_js_2.isKernelVersionAfter)(kernelVersion, "0.3.1") &&
                    Array.isArray(initializeFunctionData.args[4])
                    ? [...initializeFunctionData.args[4]]
                    : undefined
            };
        }
    }
    if (index === undefined || validatorInitData === undefined)
        throw new Error("Invalid initCode");
    return { index, validatorInitData, useMetaFactory };
};
exports.decodeParamsFromInitCode = decodeParamsFromInitCode;
//# sourceMappingURL=deserializePermissionAccount.js.map