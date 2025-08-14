import type { Abi, Address } from "viem";
import type { Policy, PolicyParams } from "../types.js";
import { type Permission } from "./types.js";
export declare enum CallPolicyVersion {
    V0_0_1 = "0.0.1",
    V0_0_2 = "0.0.2",
    V0_0_3 = "0.0.3",
    V0_0_4 = "0.0.4"
}
export declare const getCallPolicyAddress: (policyVersion: CallPolicyVersion, policyAddress?: Address) => Address;
export type CallPolicyParams<TAbi extends Abi | readonly unknown[], TFunctionName extends string | undefined = string> = PolicyParams & {
    policyVersion: CallPolicyVersion;
    permissions?: Permission<TAbi, TFunctionName>[];
};
export declare function toCallPolicy<TAbi extends Abi | readonly unknown[], TFunctionName extends string | undefined = string>({ policyAddress, policyFlag, policyVersion, permissions }: CallPolicyParams<TAbi, TFunctionName>): Policy;
//# sourceMappingURL=toCallPolicy.d.ts.map