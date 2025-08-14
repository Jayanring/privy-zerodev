"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPermissionValidator = void 0;
const sdk_1 = require("@zerodev/sdk");
const viem_1 = require("viem");
const account_abstraction_1 = require("viem/account-abstraction");
const actions_1 = require("viem/actions");
const utils_1 = require("viem/utils");
const constants_js_1 = require("./constants.js");
const index_js_1 = require("./policies/index.js");
const index_js_2 = require("./signers/index.js");
async function toPermissionValidator(client, { signer, policies, entryPoint, kernelVersion: _, flag = constants_js_1.PolicyFlags.FOR_ALL_VALIDATION }) {
    const chainId = client.chain ? client.chain.id : await (0, actions_1.getChainId)(client);
    if (entryPoint.version !== "0.7") {
        throw new Error("Only EntryPoint 0.7 is supported");
    }
    const getEnableData = async (_kernelAccountAddress) => {
        const enableData = (0, viem_1.encodeAbiParameters)([{ name: "policyAndSignerData", type: "bytes[]" }], [
            [
                ...policies.map((policy) => (0, viem_1.concat)([
                    policy.getPolicyInfoInBytes(),
                    policy.getPolicyData()
                ])),
                (0, viem_1.concat)([
                    flag,
                    signer.signerContractAddress,
                    signer.getSignerData()
                ])
            ]
        ]);
        return enableData;
    };
    const getPermissionId = () => {
        const pIdData = (0, viem_1.encodeAbiParameters)([{ name: "policyAndSignerData", type: "bytes[]" }], [[(0, index_js_1.toPolicyId)(policies), flag, (0, index_js_2.toSignerId)(signer)]]);
        return (0, viem_1.slice)((0, viem_1.keccak256)(pIdData), 0, 4);
    };
    return {
        ...signer.account,
        supportedKernelVersions: ">=0.3.0",
        validatorType: "PERMISSION",
        address: viem_1.zeroAddress,
        source: "PermissionValidator",
        getEnableData,
        getIdentifier: getPermissionId,
        signMessage: async ({ message }) => {
            return (0, viem_1.concat)([
                "0xff",
                await signer.account.signMessage({ message })
            ]);
        },
        signTypedData: async (typedData) => {
            return (0, viem_1.concat)([
                "0xff",
                await signer.account.signTypedData(typedData)
            ]);
        },
        signUserOperation: async (userOperation) => {
            const userOpHash = (0, account_abstraction_1.getUserOperationHash)({
                userOperation: {
                    ...userOperation,
                    signature: "0x"
                },
                entryPointAddress: entryPoint.address,
                entryPointVersion: entryPoint.version,
                chainId
            });
            const signature = await signer.account.signMessage({
                message: { raw: userOpHash }
            });
            return (0, viem_1.concat)(["0xff", signature]);
        },
        async getNonceKey(_accountAddress, customNonceKey) {
            if (customNonceKey) {
                return customNonceKey;
            }
            return 0n;
        },
        async getStubSignature(_userOperation) {
            return (0, viem_1.concat)(["0xff", signer.getDummySignature()]);
        },
        getPluginSerializationParams: () => {
            return {
                policies
            };
        },
        isEnabled: async (kernelAccountAddress, _selector) => {
            try {
                const permissionConfig = await (0, utils_1.getAction)(client, actions_1.readContract, "readContract")({
                    abi: sdk_1.KernelV3AccountAbi,
                    address: kernelAccountAddress,
                    functionName: "permissionConfig",
                    args: [getPermissionId()]
                });
                return permissionConfig.signer === signer.signerContractAddress;
            }
            catch (error) {
                return false;
            }
        }
    };
}
exports.toPermissionValidator = toPermissionValidator;
//# sourceMappingURL=toPermissionValidator.js.map