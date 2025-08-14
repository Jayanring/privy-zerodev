import type { WebAuthnKey } from "@zerodev/webauthn-key";
import { type Address, type Chain, type Client, type Transport } from "viem";
import type { ModularSigner, ModularSignerParams } from "../types.js";
export declare enum WebAuthnSignerVersion {
    V0_0_1 = "0.0.1",
    V0_0_2 = "0.0.2",
    V0_0_3 = "0.0.3"
}
export type WebAuthnModularSignerParams = ModularSignerParams & {
    webAuthnKey: WebAuthnKey;
    webAuthnSignerVersion: WebAuthnSignerVersion;
};
export declare const getWebAuthnSignerAddress: (webAuthnSignerVersion: WebAuthnSignerVersion, webAuthnSignerAddress?: Address) => Address;
export declare const toWebAuthnSigner: <TTransport extends Transport = Transport, TChain extends Chain | undefined = Chain | undefined>(client: Client<TTransport, TChain, undefined>, { signerContractAddress, webAuthnKey, webAuthnSignerVersion }: WebAuthnModularSignerParams) => Promise<ModularSigner>;
//# sourceMappingURL=toWebAuthnSigner.d.ts.map