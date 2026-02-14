import type { EncryptedBlob } from "../types/domain";
import argon2 from "./argon2";

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

  const result = await argon2.hash({
    pass: passphrase,
    salt: saltBytes,
    time: ARGON2_TIME_COST,
    mem: ARGON2_MEMORY_COST,
    hashLen: ARGON2_HASH_LENGTH,
    parallelism: ARGON2_PARALLELISM,
    type: argon2.ArgonType.Argon2id,
  });

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

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv).buffer as ArrayBuffer },
    key,
    new Uint8Array(ciphertext).buffer as ArrayBuffer,
  );

  return new TextDecoder().decode(plaintextBuffer);
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
