import { type Abi, type Address, type Hex } from "viem";
import { type GeneratePermissionWithPolicyAddressParameters, type PermissionCore } from "./types.js";
export declare function getPermissionFromABI<TAbi extends Abi | readonly unknown[], TFunctionName extends string | undefined = string>({ abi, args, functionName, policyAddress, selector }: GeneratePermissionWithPolicyAddressParameters<TAbi, TFunctionName>): Pick<PermissionCore, "selector" | "rules">;
export declare const encodePermissionData: (permission: PermissionCore | PermissionCore[], policyAddress: Address) => Hex;
//# sourceMappingURL=callPolicyUtils.d.ts.map