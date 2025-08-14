import { type Address } from "viem";
import type { Policy, PolicyParams } from "../types.js";
export type GasPolicyParams = PolicyParams & {
    allowed?: bigint;
    enforcePaymaster?: boolean;
    allowedPaymaster?: Address;
};
export declare function toGasPolicy({ policyAddress, policyFlag, allowed, enforcePaymaster, allowedPaymaster }: GasPolicyParams): Policy;
//# sourceMappingURL=toGasPolicy.d.ts.map