// ESM wrapper for argon2-browser's UMD module.
// argon2-browser has no ESM build and is excluded from Vite's dep
// optimizer (because of WASM). The UMD sets self.argon2 in the
// browser code path, so we import it for side effects and re-export
// the global.
import "argon2-browser";

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

const argon2 = (self as unknown as { argon2: Argon2 }).argon2;
export default argon2;
