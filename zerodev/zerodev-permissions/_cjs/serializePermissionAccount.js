"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializePermissionAccount = void 0;
const utils_js_1 = require("./utils.js");
const serializePermissionAccount = async (account, privateKey, enableSignature, eip7702Auth, permissionPlugin) => {
    let permissionParams;
    let isPreInstalled = false;
    const action = account.kernelPluginManager.getAction();
    const validityData = account.kernelPluginManager.getValidityData();
    if ((0, utils_js_1.isPermissionValidatorPlugin)(account.kernelPluginManager)) {
        permissionParams =
            account.kernelPluginManager.getPluginSerializationParams();
    }
    else if (permissionPlugin) {
        permissionParams = permissionPlugin.getPluginSerializationParams();
        isPreInstalled = true;
    }
    else {
        throw new Error("No permission validator found in account or provided");
    }
    const _enableSignature = isPreInstalled
        ? undefined
        : (enableSignature ??
            (await account.kernelPluginManager.getPluginEnableSignature(account.address)));
    const _eip7702Auth = account.authorization
        ? (eip7702Auth ?? (await account?.eip7702Authorization?.()))
        : undefined;
    const accountParams = {
        initCode: await account.generateInitCode(),
        accountAddress: account.address
    };
    const paramsToBeSerialized = {
        permissionParams,
        action,
        validityData,
        accountParams,
        enableSignature: _enableSignature,
        privateKey,
        eip7702Auth: _eip7702Auth,
        isPreInstalled
    };
    return (0, utils_js_1.serializePermissionAccountParams)(paramsToBeSerialized);
};
exports.serializePermissionAccount = serializePermissionAccount;
//# sourceMappingURL=serializePermissionAccount.js.map