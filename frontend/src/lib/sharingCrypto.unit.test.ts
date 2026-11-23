import { describe, expect, it } from "vitest";
import {
  DecryptError,
  decrypt,
  encrypt,
  generateShareKeyPair,
  generateTreeKey,
  importSharePrivateKey,
  importSharePublicKey,
  unwrapTreeKey,
  wrapTreeKey,
} from "./crypto";

describe("sharing crypto", () => {
  it("round-trips a tree key through wrap and unwrap", async () => {
    const pair = await generateShareKeyPair();
    const tree = await generateTreeKey();
    const wrapped = await wrapTreeKey(tree.base64, await importSharePublicKey(pair.publicJwk));
    const unwrapped = await unwrapTreeKey(wrapped, await importSharePrivateKey(pair.privateJwk));

    const blob = await encrypt("secret", tree.key);
    expect(await decrypt(blob, unwrapped)).toBe("secret");
  }, 60000);

  it("unwrap with another pair's private key throws DecryptError", async () => {
    const [a, b] = await Promise.all([generateShareKeyPair(), generateShareKeyPair()]);
    const tree = await generateTreeKey();
    const wrapped = await wrapTreeKey(tree.base64, await importSharePublicKey(a.publicJwk));
    await expect(unwrapTreeKey(wrapped, await importSharePrivateKey(b.privateJwk))).rejects.toThrow(
      DecryptError,
    );
  }, 60000);

  it("imported private key is not extractable and public key only encrypts", async () => {
    const pair = await generateShareKeyPair();
    const priv = await importSharePrivateKey(pair.privateJwk);
    const pub = await importSharePublicKey(pair.publicJwk);
    expect(priv.extractable).toBe(false);
    expect(priv.usages).toEqual(["decrypt"]);
    expect(pub.usages).toEqual(["encrypt"]);
    expect((priv.algorithm as RsaHashedKeyAlgorithm).modulusLength).toBe(4096);
  }, 60000);
});
