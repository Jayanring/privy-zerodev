import type { KernelSmartAccountImplementation } from "@zerodev/sdk";
import { type Hex } from "viem";
import type { SmartAccount } from "viem/account-abstraction";
export type MultiChainPermissionAccountsParams = {
    account: SmartAccount<KernelSmartAccountImplementation>;
    privateKey?: Hex;
};
export declare const serializeMultiChainPermissionAccounts: (params: MultiChainPermissionAccountsParams[]) => Promise<string[]>;
export declare function decodeSignature(signature: Hex): `0x${string}`;
//# sourceMappingURL=serializeMultiChainPermissionAccounts.d.ts.map