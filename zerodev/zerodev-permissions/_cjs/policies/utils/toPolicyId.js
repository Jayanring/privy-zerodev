"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPolicyId = void 0;
const viem_1 = require("viem");
const toPolicyId = (policies) => {
    return (0, viem_1.encodeAbiParameters)([{ name: "policiesData", type: "bytes[]" }], [
        policies.map((policy) => (0, viem_1.concat)([policy.getPolicyInfoInBytes(), policy.getPolicyData()]))
    ]);
};
exports.toPolicyId = toPolicyId;
//# sourceMappingURL=toPolicyId.js.map