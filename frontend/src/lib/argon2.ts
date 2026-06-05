// argon2-browser is loaded via a <script> tag in index.html: the self-contained
// bundled build with WASM inlined, committed at public/argon2-bundled.min.js
// (sourced from the argon2-browser npm package, v1.18.0). It sets self.argon2 as
// a global. Because the runtime uses the committed bundle, the npm package itself
// is not a code dependency. This module re-exports the global with types.

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
