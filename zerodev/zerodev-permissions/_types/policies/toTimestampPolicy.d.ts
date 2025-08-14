import type { Policy, PolicyParams } from "../types.js";
export type TimestampPolicyParams = PolicyParams & {
    validAfter?: number;
    validUntil?: number;
};
export declare function toTimestampPolicy({ policyAddress, policyFlag, validAfter, validUntil }: TimestampPolicyParams): Policy;
//# sourceMappingURL=toTimestampPolicy.d.ts.map