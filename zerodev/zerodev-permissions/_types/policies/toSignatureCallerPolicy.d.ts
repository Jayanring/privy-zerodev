import { type Address } from "viem";
import type { Policy, PolicyParams } from "../types.js";
export type SignatureCallerPolicyParams = PolicyParams & {
    allowedCallers: Address[];
};
export declare function toSignatureCallerPolicy({ policyAddress, policyFlag, allowedCallers }: SignatureCallerPolicyParams): Policy;
//# sourceMappingURL=toSignatureCallerPolicy.d.ts.map