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

  it("rejects an unwrapped key that is not 32 bytes", async () => {
    const pair = await generateShareKeyPair();
    const short = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
    const wrapped = await wrapTreeKey(short, await importSharePublicKey(pair.publicJwk));
    await expect(
      unwrapTreeKey(wrapped, await importSharePrivateKey(pair.privateJwk)),
    ).rejects.toThrow(DecryptError);
  }, 60000);

  it("reports a wrapped key that is not base64 as DecryptError", async () => {
    const pair = await generateShareKeyPair();
    const priv = await importSharePrivateKey(pair.privateJwk);
    await expect(unwrapTreeKey("not base64!", priv)).rejects.toThrow(DecryptError);
  }, 60000);

  it("lets a programming error through instead of calling it DecryptError", async () => {
    const result = unwrapTreeKey(btoa("x".repeat(512)), {} as CryptoKey);
    await expect(result).rejects.toThrow();
    await expect(result).rejects.not.toBeInstanceOf(DecryptError);
  });

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
