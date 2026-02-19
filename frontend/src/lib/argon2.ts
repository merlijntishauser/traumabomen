// argon2-browser is loaded via <script> tag in index.html (the self-contained
// bundled build with WASM inlined). It sets self.argon2 as a global.
// This module re-exports it with types for use in the rest of the app.

interface Argon2 {
  ArgonType: { Argon2d: 0; Argon2i: 1; Argon2id: 2 };
  hash(options: {
    pass: string | Uint8Array;
    salt: string | Uint8Array;
    time?: number;
    mem?: number;
    hashLen?: number;
    parallelism?: number;
    type?: number;
  }): Promise<{ hash: Uint8Array; hashHex: string; encoded: string }>;
}

function getArgon2(): Argon2 {
  const a2 = (self as unknown as { argon2?: Argon2 }).argon2;
  if (!a2) throw new Error("argon2-browser not loaded yet");
  return a2;
}

export default {
  get ArgonType() {
    return getArgon2().ArgonType;
  },
  hash(options: Parameters<Argon2["hash"]>[0]) {
    return getArgon2().hash(options);
  },
} satisfies Argon2;
