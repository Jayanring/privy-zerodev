import { type Client } from "viem";
import { type EntryPointVersion } from "viem/account-abstraction";
import type { PermissionPlugin, PermissionPluginParams } from "./types.js";
export declare function toPermissionValidator<entryPointVersion extends EntryPointVersion>(client: Client, { signer, policies, entryPoint, kernelVersion, flag }: PermissionPluginParams<entryPointVersion>): Promise<PermissionPlugin>;
//# sourceMappingURL=toPermissionValidator.d.ts.map