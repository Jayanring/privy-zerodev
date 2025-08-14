"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toWebAuthnSigner = exports.getWebAuthnSignerAddress = exports.WebAuthnSignerVersion = void 0;
const webauthn_key_1 = require("@zerodev/webauthn-key");
const viem_1 = require("viem");
const viem_2 = require("viem");
const accounts_1 = require("viem/accounts");
const actions_1 = require("viem/actions");
const constants_js_1 = require("../constants.js");
var WebAuthnSignerVersion;
(function (WebAuthnSignerVersion) {
    WebAuthnSignerVersion["V0_0_1"] = "0.0.1";
    WebAuthnSignerVersion["V0_0_2"] = "0.0.2";
    WebAuthnSignerVersion["V0_0_3"] = "0.0.3";
})(WebAuthnSignerVersion || (exports.WebAuthnSignerVersion = WebAuthnSignerVersion = {}));
const signMessageUsingWebAuthn = async (message, chainId, allowCredentials) => {
    let messageContent;
    if (typeof message === "string") {
        messageContent = message;
    }
    else if ("raw" in message && typeof message.raw === "string") {
        messageContent = message.raw;
    }
    else if ("raw" in message && message.raw instanceof Uint8Array) {
        messageContent = message.raw.toString();
    }
    else {
        throw new Error("Unsupported message format");
    }
    const formattedMessage = messageContent.startsWith("0x")
        ? messageContent.slice(2)
        : messageContent;
    const challenge = (0, webauthn_key_1.base64FromUint8Array)((0, webauthn_key_1.hexStringToUint8Array)(formattedMessage), true);
    const assertionOptions = {
        challenge,
        allowCredentials,
        userVerification: "required"
    };
    const { startAuthentication } = await Promise.resolve().then(() => require("@simplewebauthn/browser"));
    const cred = await startAuthentication(assertionOptions);
    const { authenticatorData } = cred.response;
    const authenticatorDataHex = (0, webauthn_key_1.uint8ArrayToHexString)((0, webauthn_key_1.b64ToBytes)(authenticatorData));
    const clientDataJSON = atob(cred.response.clientDataJSON);
    const { beforeType } = (0, webauthn_key_1.findQuoteIndices)(clientDataJSON);
    const { signature } = cred.response;
    const signatureHex = (0, webauthn_key_1.uint8ArrayToHexString)((0, webauthn_key_1.b64ToBytes)(signature));
    const { r, s } = (0, webauthn_key_1.parseAndNormalizeSig)(signatureHex);
    const encodedSignature = (0, viem_2.encodeAbiParameters)([
        { name: "authenticatorData", type: "bytes" },
        { name: "clientDataJSON", type: "string" },
        { name: "responseTypeLocation", type: "uint256" },
        { name: "r", type: "uint256" },
        { name: "s", type: "uint256" },
        { name: "usePrecompiled", type: "bool" }
    ], [
        authenticatorDataHex,
        clientDataJSON,
        beforeType,
        BigInt(r),
        BigInt(s),
        (0, webauthn_key_1.isRIP7212SupportedNetwork)(chainId)
    ]);
    return encodedSignature;
};
const getWebAuthnSignerAddress = (webAuthnSignerVersion, webAuthnSignerAddress) => {
    if (webAuthnSignerAddress)
        return webAuthnSignerAddress;
    switch (webAuthnSignerVersion) {
        case WebAuthnSignerVersion.V0_0_1:
            return constants_js_1.WEBAUTHN_SIGNER_CONTRACT_V0_0_1;
        case WebAuthnSignerVersion.V0_0_2:
            return constants_js_1.WEBAUTHN_SIGNER_CONTRACT_V0_0_2;
        case WebAuthnSignerVersion.V0_0_3:
            return constants_js_1.WEBAUTHN_SIGNER_CONTRACT_V0_0_3;
    }
};
exports.getWebAuthnSignerAddress = getWebAuthnSignerAddress;
const toWebAuthnSigner = async (client, { signerContractAddress, webAuthnKey, webAuthnSignerVersion }) => {
    const webAuthnSignerAddress = (0, exports.getWebAuthnSignerAddress)(webAuthnSignerVersion, signerContractAddress);
    const chainId = await (0, actions_1.getChainId)(client);
    const account = (0, accounts_1.toAccount)({
        address: "0x0000000000000000000000000000000000000000",
        async signMessage({ message }) {
            return signMessageUsingWebAuthn(message, chainId, [
                { id: webAuthnKey.authenticatorId, type: "public-key" }
            ]);
        },
        async signTransaction(_, __) {
            throw new Error("Smart account signer doesn't need to sign transactions");
        },
        async signTypedData(typedData) {
            const { domain, message, primaryType } = typedData;
            const types = {
                EIP712Domain: (0, viem_1.getTypesForEIP712Domain)({ domain }),
                ...typedData.types
            };
            (0, viem_1.validateTypedData)({ domain, message, primaryType, types });
            const hash = (0, viem_1.hashTypedData)(typedData);
            const signature = await (0, actions_1.signMessage)(client, {
                account,
                message: hash
            });
            return signature;
        }
    });
    return {
        account,
        signerContractAddress: webAuthnSignerAddress,
        getSignerData: () => {
            return (0, viem_2.encodeAbiParameters)([
                {
                    components: [
                        { name: "pubKeyX", type: "uint256" },
                        { name: "pubKeyY", type: "uint256" }
                    ],
                    name: "WebAuthnSignerData",
                    type: "tuple"
                },
                { name: "authenticatorIdHash", type: "bytes32" }
            ], [
                { pubKeyX: webAuthnKey.pubX, pubKeyY: webAuthnKey.pubY },
                webAuthnKey.authenticatorIdHash
            ]);
        },
        getDummySignature: () => {
            return (0, viem_2.encodeAbiParameters)([
                { name: "authenticatorData", type: "bytes" },
                { name: "clientDataJSON", type: "string" },
                { name: "responseTypeLocation", type: "uint256" },
                { name: "r", type: "uint256" },
                { name: "s", type: "uint256" },
                { name: "usePrecompiled", type: "bool" }
            ], [
                "0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97631d00000000",
                '{"type":"webauthn.get","challenge":"tbxXNFS9X_4Byr1cMwqKrIGB-_30a0QhZ6y7ucM0BOE","origin":"http://localhost:3000","crossOrigin":false, "other_keys_can_be_added_here":"do not compare clientDataJSON against a template. See https://goo.gl/yabPex"}',
                1n,
                44941127272049826721201904734628716258498742255959991581049806490182030242267n,
                9910254599581058084911561569808925251374718953855182016200087235935345969636n,
                false
            ]);
        }
    };
};
exports.toWebAuthnSigner = toWebAuthnSigner;
//# sourceMappingURL=toWebAuthnSigner.js.map