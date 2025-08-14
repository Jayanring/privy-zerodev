"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decodeSignature = exports.serializeMultiChainPermissionAccounts = void 0;
const merkletreejs_1 = require("merkletreejs");
const viem_1 = require("viem");
const utils_js_1 = require("./utils.js");
const serializeMultiChainPermissionAccounts = async (params) => {
    if (params.length === 0)
        return [];
    const permissionParamsPerAccounts = params.map((param) => {
        if (!(0, utils_js_1.isPermissionValidatorPlugin)(param.account.kernelPluginManager)) {
            throw new Error("Account plugin is not a permission validator");
        }
        return param.account.kernelPluginManager.getPluginSerializationParams();
    });
    const actions = params.map((param) => param.account.kernelPluginManager.getAction());
    const validityDataPerAccounts = params.map((param) => param.account.kernelPluginManager.getValidityData());
    const pluginEnableTypedDatas = await Promise.all(params.map(async (param) => {
        return param.account.kernelPluginManager.getPluginsEnableTypedData(param.account.address);
    }));
    const leaves = pluginEnableTypedDatas.map((typedData) => {
        return (0, viem_1.hashTypedData)(typedData);
    });
    const merkleTree = new merkletreejs_1.MerkleTree(leaves, viem_1.keccak256, {
        sortPairs: true
    });
    const merkleRoot = merkleTree.getHexRoot();
    const toEthSignedMessageHash = (0, viem_1.hashMessage)({ raw: merkleRoot });
    let signature = "0x";
    if (params[0].account.kernelPluginManager.sudoValidator?.source ===
        "MultiChainECDSAValidator") {
        signature =
            await params[0].account.kernelPluginManager.sudoValidator?.signMessage({
                message: {
                    raw: merkleRoot
                }
            });
    }
    if (params[0].account.kernelPluginManager.sudoValidator?.source ===
        "MultiChainWebAuthnValidator") {
        const encodedSignature = await params[0].account.kernelPluginManager.sudoValidator?.signMessage({
            message: {
                raw: toEthSignedMessageHash
            }
        });
        signature = decodeSignature(encodedSignature);
    }
    const enableSignatures = await Promise.all(params.map(async (param, index) => {
        if (!param.account.kernelPluginManager.sudoValidator) {
            throw new Error("No sudo validator found, check if sudo validator is multi-chain validator");
        }
        const merkleProof = merkleTree.getHexProof(leaves[index]);
        const encodedMerkleProof = (0, viem_1.encodeAbiParameters)([{ name: "proof", type: "bytes32[]" }], [merkleProof]);
        if (param.account.kernelPluginManager.sudoValidator.source ===
            "MultiChainECDSAValidator") {
            return (0, viem_1.concatHex)([signature, merkleRoot, encodedMerkleProof]);
        }
        if (param.account.kernelPluginManager.sudoValidator.source ===
            "MultiChainWebAuthnValidator") {
            const merkleData = (0, viem_1.concatHex)([merkleRoot, encodedMerkleProof]);
            return (0, viem_1.encodeAbiParameters)([
                {
                    name: "merkleData",
                    type: "bytes"
                },
                {
                    name: "signature",
                    type: "bytes"
                }
            ], [merkleData, signature]);
        }
        throw new Error("Unknown multi-chain validator");
    }));
    const accountParamsPerAccounts = await Promise.all(params.map(async (param) => {
        return {
            initCode: await param.account.generateInitCode(),
            accountAddress: param.account.address
        };
    }));
    const paramsToBeSerialized = params.map((param, index) => {
        return (0, utils_js_1.serializePermissionAccountParams)({
            permissionParams: permissionParamsPerAccounts[index],
            action: actions[index],
            validityData: validityDataPerAccounts[index],
            accountParams: accountParamsPerAccounts[index],
            enableSignature: enableSignatures[index],
            privateKey: param.privateKey
        });
    });
    return paramsToBeSerialized;
};
exports.serializeMultiChainPermissionAccounts = serializeMultiChainPermissionAccounts;
function decodeSignature(signature) {
    const [_, passkeySig] = (0, viem_1.decodeAbiParameters)([
        {
            name: "merkleData",
            type: "bytes"
        },
        {
            name: "signature",
            type: "bytes"
        }
    ], signature);
    return passkeySig;
}
exports.decodeSignature = decodeSignature;
//# sourceMappingURL=serializeMultiChainPermissionAccounts.js.map