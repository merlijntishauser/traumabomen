import type { EncryptedBlob } from "../types/domain";
import argon2 from "./argon2";

export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

export class DecryptError extends CryptoError {
  constructor(message = "Failed to decrypt data. Wrong passphrase or corrupted data.") {
    super(message);
    this.name = "DecryptError";
  }
}

export class KeyDerivationError extends CryptoError {
  declare cause: unknown;
  constructor(cause?: unknown) {
    super("Failed to derive encryption key.");
    this.name = "KeyDerivationError";
    this.cause = cause;
  }
}

export class PassphraseError extends CryptoError {
  constructor() {
    super("Incorrect passphrase.");
    this.name = "PassphraseError";
  }
}

const ARGON2_TIME_COST = 3;
const ARGON2_MEMORY_COST = 65536; // 64 MB
const ARGON2_PARALLELISM = 1;
const ARGON2_HASH_LENGTH = 32;

const IV_LENGTH = 12;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return toBase64(salt);
}

export async function deriveKey(passphrase: string, salt: string): Promise<CryptoKey> {
  const saltBytes = fromBase64(salt);

  let result: { hash: ArrayLike<number> };
  try {
    result = await argon2.hash({
      pass: passphrase,
      salt: saltBytes,
      time: ARGON2_TIME_COST,
      mem: ARGON2_MEMORY_COST,
      hashLen: ARGON2_HASH_LENGTH,
      parallelism: ARGON2_PARALLELISM,
      type: argon2.ArgonType.Argon2id,
    });
  } catch (error) {
    throw new KeyDerivationError(error);
  }

  return crypto.subtle.importKey(
    "raw",
    new Uint8Array(result.hash).buffer as ArrayBuffer,
    { name: "AES-GCM" },
    false, // non-extractable
    ["encrypt", "decrypt"],
  );
}

export async function encrypt(plaintext: string, key: CryptoKey): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertextBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  return {
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertextBuffer)),
  };
}

export async function decrypt(blob: EncryptedBlob, key: CryptoKey): Promise<string> {
  const iv = fromBase64(blob.iv);
  const ciphertext = fromBase64(blob.ciphertext);

  if (iv.length !== IV_LENGTH) {
    throw new DecryptError(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
  }

  try {
    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv).buffer as ArrayBuffer },
      key,
      new Uint8Array(ciphertext).buffer as ArrayBuffer,
    );

    return new TextDecoder().decode(plaintextBuffer);
  } catch {
    throw new DecryptError();
  }
}

export async function hashPassphrase(passphrase: string): Promise<string> {
  const encoded = new TextEncoder().encode(passphrase);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return toBase64(new Uint8Array(hashBuffer));
}

export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

export interface GeneratedTreeKey {
  key: CryptoKey;
  base64: string;
}

export async function generateTreeKey(): Promise<GeneratedTreeKey> {
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const base64 = toBase64(rawKey);
  const key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
  return { key, base64 };
}

export async function importTreeKey(base64Key: string): Promise<CryptoKey> {
  const raw = fromBase64(base64Key);
  return crypto.subtle.importKey("raw", raw.buffer as ArrayBuffer, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptKeyRing(
  keyRing: Record<string, string>,
  masterKey: CryptoKey,
): Promise<string> {
  return encryptForApi(keyRing, masterKey);
}

export async function decryptKeyRing(
  encryptedKeyRing: string,
  masterKey: CryptoKey,
): Promise<Record<string, string>> {
  return decryptFromApi<Record<string, string>>(encryptedKeyRing, masterKey);
}

export async function encryptForApi(data: unknown, key: CryptoKey): Promise<string> {
  const plaintext = JSON.stringify(data);
  const blob = await encrypt(plaintext, key);
  return JSON.stringify(blob);
}

export async function decryptFromApi<T>(encryptedData: string, key: CryptoKey): Promise<T> {
  const blob: EncryptedBlob = JSON.parse(encryptedData);
  const plaintext = await decrypt(blob, key);
  return JSON.parse(plaintext) as T;
}
