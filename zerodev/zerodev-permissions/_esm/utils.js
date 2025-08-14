import { coerce, gt } from "semver";
export function base64ToBytes(base64) {
    const binString = atob(base64);
    return Uint8Array.from(binString, (m) => m.codePointAt(0));
}
export function bytesToBase64(bytes) {
    const binString = Array.from(bytes, (x) => String.fromCodePoint(x)).join("");
    return btoa(binString);
}
export function isPermissionValidatorPlugin(
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
plugin) {
    return plugin?.getPluginSerializationParams !== undefined;
}
export const serializePermissionAccountParams = (params) => {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
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
export const deserializePermissionAccountParams = (params) => {
    const uint8Array = base64ToBytes(params);
    const jsonString = new TextDecoder().decode(uint8Array);
    return JSON.parse(jsonString);
};
export const isKernelVersionAfter = (kernelVersion, version) => {
    const coercedKernelVersion = coerce(kernelVersion);
    if (!coercedKernelVersion)
        return false;
    return gt(coercedKernelVersion, version);
};
//# sourceMappingURL=utils.js.map