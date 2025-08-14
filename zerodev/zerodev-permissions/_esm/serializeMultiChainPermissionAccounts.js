import { MerkleTree } from "merkletreejs";
import { concatHex, decodeAbiParameters, encodeAbiParameters, hashMessage, hashTypedData, keccak256 } from "viem";
import { isPermissionValidatorPlugin, serializePermissionAccountParams } from "./utils.js";
export const serializeMultiChainPermissionAccounts = async (params) => {
    if (params.length === 0)
        return [];
    const permissionParamsPerAccounts = params.map((param) => {
        if (!isPermissionValidatorPlugin(param.account.kernelPluginManager)) {
            throw new Error("Account plugin is not a permission validator");
        }
        return param.account.kernelPluginManager.getPluginSerializationParams();
    });
    const actions = params.map((param) => param.account.kernelPluginManager.getAction());
    const validityDataPerAccounts = params.map((param) => param.account.kernelPluginManager.getValidityData());
    const pluginEnableTypedDatas = await Promise.all(params.map(async (param) => {
        return param.account.kernelPluginManager.getPluginsEnableTypedData(param.account.address);
    }));
    // build merkle tree for enable signatures
    const leaves = pluginEnableTypedDatas.map((typedData) => {
        return hashTypedData(typedData);
    });
    const merkleTree = new MerkleTree(leaves, keccak256, {
        sortPairs: true
    });
    const merkleRoot = merkleTree.getHexRoot();
    const toEthSignedMessageHash = hashMessage({ raw: merkleRoot });
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
    // get enable signatures for multi-chain validator
    const enableSignatures = await Promise.all(params.map(async (param, index) => {
        if (!param.account.kernelPluginManager.sudoValidator) {
            throw new Error("No sudo validator found, check if sudo validator is multi-chain validator");
        }
        const merkleProof = merkleTree.getHexProof(leaves[index]);
        const encodedMerkleProof = encodeAbiParameters([{ name: "proof", type: "bytes32[]" }], [merkleProof]);
        if (param.account.kernelPluginManager.sudoValidator.source ===
            "MultiChainECDSAValidator") {
            return concatHex([signature, merkleRoot, encodedMerkleProof]);
        }
        if (param.account.kernelPluginManager.sudoValidator.source ===
            "MultiChainWebAuthnValidator") {
            const merkleData = concatHex([merkleRoot, encodedMerkleProof]);
            return encodeAbiParameters([
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
        return serializePermissionAccountParams({
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
export function decodeSignature(signature) {
    const [_, passkeySig] = decodeAbiParameters([
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
//# sourceMappingURL=serializeMultiChainPermissionAccounts.js.map