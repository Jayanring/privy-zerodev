import type { KernelSmartAccountImplementation } from "@zerodev/sdk";
import type { Hex } from "viem";
import type { SmartAccount } from "viem/account-abstraction";
import type { SignAuthorizationReturnType } from "viem/accounts";
import type { PermissionPlugin } from "./types.js";
export declare const serializePermissionAccount: (account: SmartAccount<KernelSmartAccountImplementation>, privateKey?: Hex, enableSignature?: Hex, eip7702Auth?: SignAuthorizationReturnType, permissionPlugin?: PermissionPlugin) => Promise<string>;
//# sourceMappingURL=serializePermissionAccount.d.ts.map