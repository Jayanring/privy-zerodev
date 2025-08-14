import type { Signer } from "@zerodev/sdk/types";
import type { ModularSigner, ModularSignerParams } from "../types.js";
export type ECDSAModularSignerParams = ModularSignerParams & {
    signer: Signer;
};
export declare function toECDSASigner({ signer, signerContractAddress }: ECDSAModularSignerParams): Promise<ModularSigner>;
//# sourceMappingURL=toECDSASigner.d.ts.map