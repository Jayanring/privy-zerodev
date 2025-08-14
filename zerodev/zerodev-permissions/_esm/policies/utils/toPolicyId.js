import { concat, encodeAbiParameters } from "viem";
export const toPolicyId = (policies) => {
    return encodeAbiParameters([{ name: "policiesData", type: "bytes[]" }], [
        policies.map((policy) => concat([policy.getPolicyInfoInBytes(), policy.getPolicyData()]))
    ]);
};
//# sourceMappingURL=toPolicyId.js.map