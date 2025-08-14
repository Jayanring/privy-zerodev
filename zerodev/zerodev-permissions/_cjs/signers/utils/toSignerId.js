"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSignerId = void 0;
const viem_1 = require("viem");
const toSignerId = (signer) => {
    return (0, viem_1.encodeAbiParameters)([{ name: "signerData", type: "bytes" }], [(0, viem_1.concat)([signer.signerContractAddress, signer.getSignerData()])]);
};
exports.toSignerId = toSignerId;
//# sourceMappingURL=toSignerId.js.map