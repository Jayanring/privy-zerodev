import { KernelV3_3AccountAbi, encodeCallDataEpV07 } from "@zerodev/sdk";
import { KernelVersionToAddressesMap, VALIDATOR_TYPE } from "@zerodev/sdk/constants";
import { concat, encodeFunctionData, getAbiItem, pad, toFunctionSelector, zeroAddress } from "viem";
export async function toInitConfig(permissionPlugin) {
    const permissionInstallFunctionData = encodeFunctionData({
        abi: KernelV3_3AccountAbi,
        functionName: "installValidations",
        args: [
            [
                pad(concat([
                    VALIDATOR_TYPE.PERMISSION,
                    permissionPlugin.getIdentifier()
                ]), { size: 21, dir: "right" })
            ],
            [{ nonce: 1, hook: zeroAddress }],
            [await permissionPlugin.getEnableData()],
            ["0x"]
        ]
    });
    const grantAccessFunctionData = encodeFunctionData({
        abi: KernelV3_3AccountAbi,
        functionName: "grantAccess",
        args: [
            pad(concat([
                VALIDATOR_TYPE.PERMISSION,
                permissionPlugin.getIdentifier()
            ]), { size: 21, dir: "right" }),
            toFunctionSelector(getAbiItem({ abi: KernelV3_3AccountAbi, name: "execute" })),
            true
        ]
    });
    const delegateCall = await encodeCallDataEpV07([
        {
            to: KernelVersionToAddressesMap["0.3.3"]
                .accountImplementationAddress,
            data: grantAccessFunctionData
        }
    ], "delegatecall");
    return [permissionInstallFunctionData, delegateCall];
}
//# sourceMappingURL=toInitConfig.js.map