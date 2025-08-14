import type { PermissionAccountParams, PermissionPlugin } from "./types.js";
export declare function base64ToBytes(base64: string): Uint8Array;
export declare function bytesToBase64(bytes: Uint8Array): string;
export declare function isPermissionValidatorPlugin(plugin: any): plugin is PermissionPlugin;
export declare const serializePermissionAccountParams: (params: PermissionAccountParams) => string;
export declare const deserializePermissionAccountParams: (params: string) => PermissionAccountParams;
export declare const isKernelVersionAfter: (kernelVersion: string, version: string) => boolean;
//# sourceMappingURL=utils.d.ts.map