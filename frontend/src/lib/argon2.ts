// ESM wrapper for argon2-browser's UMD module.
//
// argon2-browser has no ESM build. The UMD at lib/argon2.js sets self.argon2
// as a side effect. The Emscripten glue (dist/argon2.js) and WASM binary are
// loaded at runtime via global overrides set in index.html (before any module
// code runs) to avoid a dynamic import() that can't resolve in the browser.
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
