import type { Policy, PolicyParams } from "../types.js";
export type RateLimitPolicyParams = PolicyParams & {
    interval?: number;
    count: number;
    startAt?: number;
};
export declare function toRateLimitPolicy({ policyAddress, policyFlag, interval, count, startAt }: RateLimitPolicyParams): Policy;
//# sourceMappingURL=toRateLimitPolicy.d.ts.map