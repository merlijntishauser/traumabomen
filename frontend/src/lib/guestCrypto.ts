import argon2 from "./argon2";
import { DecryptError, KeyDerivationError } from "./crypto";

/**
 * Guest links: a link secret in the URL fragment plus a generated passphrase
 * open an encrypted read-only copy of a tree. Both sides derive everything
 * from those two values; the server only ever sees the link id and the token.
 *
 *   linkId = HKDF(linkSecret, "traumabomen/guest/v1/id", 16)
 *   salt   = HKDF(linkSecret, "traumabomen/guest/v1/salt", 16)
 *   pass   = Argon2id(passphrase, salt; t=3, m=64 MiB, p=1, 32)
 *   root   = linkSecret || pass
 *   encKey = HKDF(root, "traumabomen/guest/v1/enc", 32)
 *   token  = HKDF(root, "traumabomen/guest/v1/auth", 32)
 *
 * HKDF is SHA-256 with an empty salt. Binary values travel as unpadded base64url.
 */

export class GuestLinkFormatError extends Error {
  constructor(message = "Malformed guest link.") {
    super(message);
    this.name = "GuestLinkFormatError";
  }
}

const INFO_PREFIX = "traumabomen/guest/v1/";
const LINK_SECRET_BYTES = 32;
const LINK_SECRET_LENGTH = 43;
const IV_LENGTH = 12;

const ARGON2_TIME_COST = 3;
const ARGON2_MEMORY_COST = 65536; // KiB, 64 MiB
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LENGTH = 32;

const BASE64URL = /^[A-Za-z0-9_-]*$/;
/** What a mail client or a sentence tends to stick to the end of a link, besides whitespace. */
const TRAILING_PUNCTUATION = ".,;:)]>'\"";
/** Whitespace and hyphens, including the dashes keyboards substitute for them. */
const SEPARATOR_RUNS = /[\s\-\u{2010}-\u{2015}\u{2212}]+/gu;

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/** Strict: unpadded base64url only, and no stray bits in the last character. */
export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  if (!BASE64URL.test(text) || text.length % 4 === 1) throw new GuestLinkFormatError();
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (toBase64Url(bytes) !== text) throw new GuestLinkFormatError();
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function generateLinkSecret(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(LINK_SECRET_BYTES)));
}

/** The link secret in a URL fragment, forgiving what mail clients append. */
export function parseLinkSecret(fragment: string): string {
  const secret = trimTrailingJunk(fragment.replace(/^#/, ""));
  if (secret.length !== LINK_SECRET_LENGTH) throw new GuestLinkFormatError();
  linkSecretBytes(secret);
  return secret;
}

function trimTrailingJunk(text: string): string {
  let end = text.length;
  while (end > 0 && (TRAILING_PUNCTUATION.includes(text[end - 1]) || /\s/.test(text[end - 1]))) {
    end--;
  }
  return text.slice(0, end);
}

function linkSecretBytes(linkSecret: string): Uint8Array<ArrayBuffer> {
  const bytes = fromBase64Url(linkSecret);
  if (bytes.length !== LINK_SECRET_BYTES) throw new GuestLinkFormatError();
  return bytes;
}

export function normalizePassphrase(input: string): string {
  return input.normalize("NFKC").toLowerCase().replace(SEPARATOR_RUNS, " ").trim();
}

function hkdfParams(info: string): HkdfParams {
  return {
    name: "HKDF",
    hash: "SHA-256",
    salt: new Uint8Array(0),
    info: new TextEncoder().encode(INFO_PREFIX + info),
  };
}

async function importHkdfKey(material: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", material, "HKDF", false, ["deriveBits", "deriveKey"]);
}

async function hkdfBytes(
  key: CryptoKey,
  info: string,
  length: number,
): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.deriveBits(hkdfParams(info), key, length * 8));
}

export async function deriveLinkId(linkSecret: string): Promise<string> {
  const secretKey = await importHkdfKey(linkSecretBytes(linkSecret));
  return toBase64Url(await hkdfBytes(secretKey, "id", 16));
}

async function argon2id(passphrase: string, salt: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
  try {
    const result = await argon2.hash({
      pass: passphrase,
      salt,
      time: ARGON2_TIME_COST,
      mem: ARGON2_MEMORY_COST,
      hashLen: ARGON2_HASH_LENGTH,
      parallelism: ARGON2_PARALLELISM,
      type: argon2.ArgonType.Argon2id,
    });
    return new Uint8Array(result.hash);
  } catch (error) {
    throw new KeyDerivationError(error);
  }
}

export async function deriveGuestKeys(
  linkSecret: string,
  passphrase: string,
): Promise<{ linkId: string; token: string; encKey: CryptoKey }> {
  const secret = linkSecretBytes(linkSecret);
  const secretKey = await importHkdfKey(secret);
  const [linkId, salt] = await Promise.all([
    hkdfBytes(secretKey, "id", 16),
    hkdfBytes(secretKey, "salt", 16),
  ]);
  const pass = await argon2id(normalizePassphrase(passphrase), salt);

  const root = new Uint8Array(secret.length + pass.length);
  root.set(secret);
  root.set(pass, secret.length);
  const rootKey = await importHkdfKey(root);
  root.fill(0);
  pass.fill(0);

  const [encKey, token] = await Promise.all([
    crypto.subtle.deriveKey(hkdfParams("enc"), rootKey, { name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]),
    hkdfBytes(rootKey, "auth", 32),
  ]);
  return { linkId: toBase64Url(linkId), token: toBase64Url(token), encKey };
}

function aad(linkId: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(INFO_PREFIX + linkId);
}

/** Encrypts the copy as `{"iv","ciphertext"}` (standard base64), like encryptForApi. */
export async function encryptGuestCopy(
  json: string,
  encKey: CryptoKey,
  linkId: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad(linkId) },
    encKey,
    new TextEncoder().encode(json),
  );
  return JSON.stringify({ iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) });
}

/** Any malformed blob, wrong key or wrong link id is a DecryptError. */
export async function decryptGuestCopy(
  blob: string,
  encKey: CryptoKey,
  linkId: string,
): Promise<string> {
  let iv: Uint8Array<ArrayBuffer>;
  let ciphertext: Uint8Array<ArrayBuffer>;
  try {
    const parsed: unknown = JSON.parse(blob);
    if (typeof parsed !== "object" || parsed === null) throw new DecryptError();
    const fields = parsed as { iv?: unknown; ciphertext?: unknown };
    if (typeof fields.iv !== "string" || typeof fields.ciphertext !== "string") {
      throw new DecryptError();
    }
    iv = fromBase64(fields.iv);
    ciphertext = fromBase64(fields.ciphertext);
  } catch {
    throw new DecryptError("Malformed guest copy.");
  }
  if (iv.length !== IV_LENGTH) throw new DecryptError("Malformed guest copy.");

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: aad(linkId) },
      encKey,
      ciphertext,
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new DecryptError();
  }
}
