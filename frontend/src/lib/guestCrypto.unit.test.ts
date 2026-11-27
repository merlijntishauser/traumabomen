import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DecryptError, KeyDerivationError } from "./crypto";
import {
  decryptGuestCopy,
  deriveGuestKeys,
  deriveLinkId,
  encryptGuestCopy,
  fromBase64Url,
  GuestLinkFormatError,
  generateLinkSecret,
  normalizePassphrase,
  parseLinkSecret,
  toBase64Url,
} from "./guestCrypto";
import { generatePassphrase } from "./passphraseWords";
import wordListText from "./wordlists/eff-large.txt?raw";

/**
 * The argon2-browser bundle is a browser global (see argon2.ts). It runs in a
 * fresh vm context because in Node it would see `process` and try to load
 * argon2.wasm from disk instead of using its inlined binary.
 */
function loadArgon2(): unknown {
  const source = readFileSync(resolve(process.cwd(), "public/argon2-bundled.min.js"), "utf8");
  const context = vm.createContext({ WebAssembly, TextEncoder, TextDecoder, atob, console });
  context.self = context;
  new vm.Script(source, { filename: "argon2-bundled.min.js" }).runInContext(context);
  return context.argon2;
}

/*
 * Fixed vectors, computed independently in the api container with
 * `docker compose exec -T api uv run --with cryptography --with argon2-cffi python -`:
 *
 *   import base64
 *   from argon2.low_level import Type, hash_secret_raw
 *   from cryptography.hazmat.primitives import hashes
 *   from cryptography.hazmat.primitives.ciphers.aead import AESGCM
 *   from cryptography.hazmat.primitives.kdf.hkdf import HKDF
 *
 *   def b64u(b):
 *       return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
 *
 *   def hkdf(ikm, info, n):
 *       return HKDF(algorithm=hashes.SHA256(), length=n, salt=b"", info=info.encode()).derive(ikm)
 *
 *   link_secret = bytes(range(32))
 *   passphrase = "anchor ladle meadow pebble violin"
 *   link_id = hkdf(link_secret, "traumabomen/guest/v1/id", 16)
 *   salt = hkdf(link_secret, "traumabomen/guest/v1/salt", 16)
 *   pw = hash_secret_raw(passphrase.encode(), salt, 3, 65536, 1, 32, Type.ID)
 *   root = link_secret + pw
 *   enc_key = hkdf(root, "traumabomen/guest/v1/enc", 32)
 *   token = hkdf(root, "traumabomen/guest/v1/auth", 32)
 *   iv = bytes(range(100, 112))
 *   aad = ("traumabomen/guest/v1/" + b64u(link_id)).encode()
 *   ct = AESGCM(enc_key).encrypt(iv, b'{"version":1,"treeName":"Fixed vector"}', aad)
 *   print(b64u(link_secret), b64u(link_id), b64u(token))
 *   print(base64.b64encode(iv).decode(), base64.b64encode(ct).decode())
 */
const VECTOR = {
  linkSecret: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8",
  passphrase: "anchor ladle meadow pebble violin",
  linkId: "qGcSr0fI66CUDypefsCoXg",
  token: "wgmsvsTDki2wGy0M90S4KcYcEvrEqh0atotvER5cBD0",
  blob: JSON.stringify({
    iv: "ZGVmZ2hpamtsbW5v",
    ciphertext: "qamblM+8UaquHkRL/yptKkx7DMKACCJMGjt579Epo46+h2wEwTQ2tw2PragIMutWK1Hygwgq0w==",
  }),
  plaintext: '{"version":1,"treeName":"Fixed vector"}',
};

const OTHER_SECRET = toBase64Url(new Uint8Array(32).fill(7));

type GuestKeys = Awaited<ReturnType<typeof deriveGuestKeys>>;
let fixed: GuestKeys;

beforeAll(async () => {
  vi.stubGlobal("self", { argon2: loadArgon2() });
  fixed = await deriveGuestKeys(VECTOR.linkSecret, VECTOR.passphrase);
}, 60000);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fixed vectors", () => {
  it("derives the link id and token Python derives", () => {
    expect(fixed.linkId).toBe(VECTOR.linkId);
    expect(fixed.token).toBe(VECTOR.token);
  });

  it("derives the link id without the passphrase", async () => {
    expect(await deriveLinkId(VECTOR.linkSecret)).toBe(VECTOR.linkId);
  });

  it("decrypts a copy Python encrypted", async () => {
    expect(await decryptGuestCopy(VECTOR.blob, fixed.encKey, VECTOR.linkId)).toBe(VECTOR.plaintext);
  });

  it("keeps the copy key non-extractable", () => {
    expect(fixed.encKey.extractable).toBe(false);
    expect(fixed.encKey.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
  });
});

describe("decryptGuestCopy refuses", () => {
  it("a key from the wrong passphrase", async () => {
    const wrong = await deriveGuestKeys(VECTOR.linkSecret, "anchor ladle meadow pebble viola");
    expect(wrong.linkId).toBe(VECTOR.linkId);
    expect(wrong.token).not.toBe(VECTOR.token);
    await expect(decryptGuestCopy(VECTOR.blob, wrong.encKey, VECTOR.linkId)).rejects.toThrow(
      DecryptError,
    );
  }, 60000);

  it("a key from the wrong link", async () => {
    const wrong = await deriveGuestKeys(OTHER_SECRET, VECTOR.passphrase);
    expect(wrong.linkId).not.toBe(VECTOR.linkId);
    await expect(decryptGuestCopy(VECTOR.blob, wrong.encKey, VECTOR.linkId)).rejects.toThrow(
      DecryptError,
    );
  }, 60000);

  it("another link id as AAD", async () => {
    const otherId = await deriveLinkId(OTHER_SECRET);
    await expect(decryptGuestCopy(VECTOR.blob, fixed.encKey, otherId)).rejects.toThrow(
      DecryptError,
    );
  });

  it("a flipped ciphertext byte", async () => {
    const { iv, ciphertext } = JSON.parse(VECTOR.blob);
    const bytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
    bytes[3] ^= 0x01;
    const tampered = JSON.stringify({ iv, ciphertext: btoa(String.fromCharCode(...bytes)) });
    await expect(decryptGuestCopy(tampered, fixed.encKey, VECTOR.linkId)).rejects.toThrow(
      DecryptError,
    );
  });

  it.each([
    ["not JSON", "{"],
    ["no iv", JSON.stringify({ ciphertext: "AAAA" })],
    ["a short iv", JSON.stringify({ iv: "AAAA", ciphertext: "AAAA" })],
    ["non-base64", JSON.stringify({ iv: "ZGVmZ2hpamtsbW5v", ciphertext: "***" })],
    ["a non-object", "null"],
  ])("a blob with %s", async (_label, blob) => {
    await expect(decryptGuestCopy(blob, fixed.encKey, VECTOR.linkId)).rejects.toThrow(DecryptError);
  });
});

describe("encryptGuestCopy", () => {
  it("round-trips", async () => {
    const json = JSON.stringify({ version: 1, treeName: "Round trip" });
    const blob = await encryptGuestCopy(json, fixed.encKey, fixed.linkId);
    expect(await decryptGuestCopy(blob, fixed.encKey, fixed.linkId)).toBe(json);
  });

  it("uses a fresh 12-byte IV for every encryption", async () => {
    const a = JSON.parse(await encryptGuestCopy("same", fixed.encKey, fixed.linkId));
    const b = JSON.parse(await encryptGuestCopy("same", fixed.encKey, fixed.linkId));
    expect(atob(a.iv)).toHaveLength(12);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });
});

describe("normalizePassphrase", () => {
  it.each([
    ["Apple  Banana-cherry\n", "apple banana cherry"],
    ["  apple - banana\tcherry ", "apple banana cherry"],
    ["APPLE--BANANA\u{a0}cherry", "apple banana cherry"],
    ["\u{ff41}pple banana cherry", "apple banana cherry"],
    ["apple\u{2013}banana cherry", "apple banana cherry"],
  ])("normalises %j", (input, expected) => {
    expect(normalizePassphrase(input)).toBe(expected);
  });

  it.each([
    "\u{2010}",
    "\u{2011}",
    "\u{2012}",
    "\u{2013}",
    "\u{2014}",
    "\u{2015}",
    "\u{2212}",
    "\u{ff0d}",
  ])("folds the dash %j into a separator, as the spec states", (dash) => {
    expect(normalizePassphrase(`apple${dash}${dash} banana${dash}cherry`)).toBe(
      "apple banana cherry",
    );
  });

  it("keeps other punctuation as typed", () => {
    expect(normalizePassphrase("apple_banana cherry.")).toBe("apple_banana cherry.");
  });

  it("derives the same keys for a passphrase typed differently", async () => {
    const typed = await deriveGuestKeys(VECTOR.linkSecret, "Apple  Banana-cherry\n");
    const clean = await deriveGuestKeys(VECTOR.linkSecret, "apple banana cherry");
    expect(typed.token).toBe(clean.token);
    const blob = await encryptGuestCopy("copy", typed.encKey, typed.linkId);
    expect(await decryptGuestCopy(blob, clean.encKey, clean.linkId)).toBe("copy");
  }, 60000);
});

describe("deriveGuestKeys", () => {
  it("reports an Argon2id failure as a KeyDerivationError", async () => {
    vi.stubGlobal("self", {
      argon2: { ArgonType: { Argon2id: 2 }, hash: () => Promise.reject(new Error("oom")) },
    });
    try {
      await expect(deriveGuestKeys(VECTOR.linkSecret, VECTOR.passphrase)).rejects.toThrow(
        KeyDerivationError,
      );
    } finally {
      vi.stubGlobal("self", { argon2: loadArgon2() });
    }
  });
});

describe("base64url", () => {
  it("round-trips without padding", () => {
    const bytes = Uint8Array.from([0xfb, 0xff, 0xfe, 0x00, 0x10]);
    const encoded = toBase64Url(bytes);
    expect(encoded).toBe("-__-ABA");
    expect(fromBase64Url(encoded)).toEqual(bytes);
  });

  it.each(["abc=", "ab+c", "ab/c", "a", "ab c", "AB"])("rejects %j", (input) => {
    expect(() => fromBase64Url(input)).toThrow(GuestLinkFormatError);
  });
});

describe("generateLinkSecret", () => {
  it("makes a 43-character secret of 32 random bytes", () => {
    const secret = generateLinkSecret();
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(fromBase64Url(secret)).toHaveLength(32);
    expect(generateLinkSecret()).not.toBe(secret);
  });
});

describe("parseLinkSecret", () => {
  const secret = VECTOR.linkSecret;

  it.each([
    secret,
    `#${secret}`,
    `#${secret}.`,
    `#${secret})`,
    `${secret}\n`,
    `${secret}>`,
    `${secret}",;:]'`,
  ])("accepts %j", (fragment) => {
    expect(parseLinkSecret(fragment)).toBe(secret);
  });

  it.each([
    ["42 characters", secret.slice(0, 42)],
    ["44 characters", `${secret}A`],
    ["a non-base64url character", `${secret.slice(0, 42)}+`],
    ["a padded secret", `${secret.slice(0, 42)}=`],
    ["an empty fragment", "#"],
    ["unused trailing bits", `${secret.slice(0, 42)}9`],
  ])("rejects %s", (_label, fragment) => {
    expect(() => parseLinkSecret(fragment)).toThrow(GuestLinkFormatError);
  });

  it("is what deriveGuestKeys requires", async () => {
    await expect(deriveGuestKeys(secret.slice(0, 42), VECTOR.passphrase)).rejects.toThrow(
      GuestLinkFormatError,
    );
    await expect(deriveLinkId("not a secret")).rejects.toThrow(GuestLinkFormatError);
  });
});

describe("generatePassphrase", () => {
  const words = wordListText.split("\n").filter(Boolean);
  const LIMIT = 4294964736; // 552336 * 7776, the largest multiple of 7776 below 2^32

  it("bundles 7776 unique lowercase ASCII words", () => {
    expect(words).toHaveLength(7776);
    expect(new Set(words).size).toBe(7776);
    for (const word of words) expect(word).toMatch(/^[a-z]+$/);
  });

  it.each(["en", "nl"] as const)("yields five list words in %s", async (language) => {
    const passphrase = await generatePassphrase(language);
    const parts = passphrase.split(" ");
    expect(parts).toHaveLength(5);
    for (const part of parts) expect(words).toContain(part);
    expect(normalizePassphrase(passphrase)).toBe(passphrase);
  });

  it("draws again for values at or above the largest multiple of 7776", async () => {
    const draws = [0xffffffff, LIMIT, 0, 1, 2, 3, LIMIT - 1];
    const spy = vi
      .spyOn(crypto, "getRandomValues")
      .mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
        (array as unknown as Uint32Array)[0] = draws.shift() ?? 0;
        return array;
      });
    const passphrase = await generatePassphrase("en");
    expect(spy).toHaveBeenCalledTimes(7);
    expect(passphrase).toBe([words[0], words[1], words[2], words[3], words[7775]].join(" "));
  });
});
