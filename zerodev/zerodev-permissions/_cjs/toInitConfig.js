"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toInitConfig = void 0;
const sdk_1 = require("@zerodev/sdk");
const constants_1 = require("@zerodev/sdk/constants");
const viem_1 = require("viem");
async function toInitConfig(permissionPlugin) {
    const permissionInstallFunctionData = (0, viem_1.encodeFunctionData)({
        abi: sdk_1.KernelV3_3AccountAbi,
        functionName: "installValidations",
        args: [
            [
                (0, viem_1.pad)((0, viem_1.concat)([
                    constants_1.VALIDATOR_TYPE.PERMISSION,
                    permissionPlugin.getIdentifier()
                ]), { size: 21, dir: "right" })
            ],
            [{ nonce: 1, hook: viem_1.zeroAddress }],
            [await permissionPlugin.getEnableData()],
            ["0x"]
        ]
    });
    const grantAccessFunctionData = (0, viem_1.encodeFunctionData)({
        abi: sdk_1.KernelV3_3AccountAbi,
        functionName: "grantAccess",
        args: [
            (0, viem_1.pad)((0, viem_1.concat)([
                constants_1.VALIDATOR_TYPE.PERMISSION,
                permissionPlugin.getIdentifier()
            ]), { size: 21, dir: "right" }),
            (0, viem_1.toFunctionSelector)((0, viem_1.getAbiItem)({ abi: sdk_1.KernelV3_3AccountAbi, name: "execute" })),
            true
        ]
    });
    const delegateCall = await (0, sdk_1.encodeCallDataEpV07)([
        {
            to: constants_1.KernelVersionToAddressesMap["0.3.3"]
                .accountImplementationAddress,
            data: grantAccessFunctionData
        }
    ], "delegatecall");
    return [permissionInstallFunctionData, delegateCall];
}
exports.toInitConfig = toInitConfig;
//# sourceMappingURL=toInitConfig.js.map