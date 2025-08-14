import { type KernelSmartAccountImplementation } from "@zerodev/sdk/accounts";
import type { EntryPointType, GetKernelVersion, KERNEL_VERSION_TYPE, ValidatorInitData } from "@zerodev/sdk/types";
import type { Hex } from "viem";
import type { EntryPointVersion } from "viem/account-abstraction";
import type { Policy } from "./types.js";
import type { ModularSigner } from "./types.js";
export declare const deserializePermissionAccount: <entryPointVersion extends EntryPointVersion>(client: KernelSmartAccountImplementation["client"], entryPoint: EntryPointType<entryPointVersion>, kernelVersion: GetKernelVersion<entryPointVersion>, modularPermissionAccountParams: string, modularSigner?: ModularSigner) => Promise<import("@zerodev/sdk").CreateKernelAccountReturnType<entryPointVersion>>;
export declare const createPolicyFromParams: (policy: Policy) => Promise<Policy>;
export declare const decodeParamsFromInitCode: (initCode: Hex, kernelVersion: KERNEL_VERSION_TYPE) => {
    index: undefined;
    validatorInitData: undefined;
    useMetaFactory: boolean;
} | {
    index: bigint;
    validatorInitData: ValidatorInitData;
    useMetaFactory: boolean;
};
//# sourceMappingURL=deserializePermissionAccount.d.ts.map