"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toEmptyECDSASigner = void 0;
const sdk_1 = require("@zerodev/sdk");
const accounts_1 = require("viem/accounts");
const constants_js_1 = require("../constants.js");
function toEmptyECDSASigner(address, signerContractAddress = constants_js_1.ECDSA_SIGNER_CONTRACT) {
    const account = (0, accounts_1.toAccount)({
        address,
        async signMessage() {
            throw new Error("Method not supported");
        },
        async signTransaction(_, __) {
            throw new Error("Method not supported");
        },
        async signTypedData(_typedData) {
            throw new Error("Method not supported");
        }
    });
    return {
        account,
        signerContractAddress: signerContractAddress,
        getSignerData: () => {
            return address;
        },
        getDummySignature: () => sdk_1.constants.DUMMY_ECDSA_SIG
    };
}
exports.toEmptyECDSASigner = toEmptyECDSASigner;
//# sourceMappingURL=toEmptyECDSASigner.js.map