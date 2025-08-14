"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isKernelVersionAfter = exports.deserializePermissionAccountParams = exports.serializePermissionAccountParams = exports.isPermissionValidatorPlugin = exports.bytesToBase64 = exports.base64ToBytes = void 0;
const semver_1 = require("semver");
function base64ToBytes(base64) {
    const binString = atob(base64);
    return Uint8Array.from(binString, (m) => m.codePointAt(0));
}
exports.base64ToBytes = base64ToBytes;
function bytesToBase64(bytes) {
    const binString = Array.from(bytes, (x) => String.fromCodePoint(x)).join("");
    return btoa(binString);
}
exports.bytesToBase64 = bytesToBase64;
function isPermissionValidatorPlugin(plugin) {
    return plugin?.getPluginSerializationParams !== undefined;
}
exports.isPermissionValidatorPlugin = isPermissionValidatorPlugin;
const serializePermissionAccountParams = (params) => {
    const replacer = (_, value) => {
        if (typeof value === "bigint") {
            return value.toString();
        }
        return value;
    };
    const jsonString = JSON.stringify(params, replacer);
    const uint8Array = new TextEncoder().encode(jsonString);
    const base64String = bytesToBase64(uint8Array);
    return base64String;
};
exports.serializePermissionAccountParams = serializePermissionAccountParams;
const deserializePermissionAccountParams = (params) => {
    const uint8Array = base64ToBytes(params);
    const jsonString = new TextDecoder().decode(uint8Array);
    return JSON.parse(jsonString);
};
exports.deserializePermissionAccountParams = deserializePermissionAccountParams;
const isKernelVersionAfter = (kernelVersion, version) => {
    const coercedKernelVersion = (0, semver_1.coerce)(kernelVersion);
    if (!coercedKernelVersion)
        return false;
    return (0, semver_1.gt)(coercedKernelVersion, version);
};
exports.isKernelVersionAfter = isKernelVersionAfter;
//# sourceMappingURL=utils.js.map