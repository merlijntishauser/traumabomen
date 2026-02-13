// ESM wrapper for argon2-browser's UMD module.
//
// argon2-browser's lib/argon2.js (UMD) uses dynamic import('../dist/argon2.js')
// to load the Emscripten glue code, which Rollup cannot bundle for browsers
// (it requires Node.js built-ins: fs, path). We provide global overrides so
// the library loads both the glue and the WASM binary from our public/ copies.

const _self = self as Record<string, unknown>;

// Tell the library where to fetch the WASM binary from.
_self.argon2WasmPath = "/argon2.wasm";

// Provide the Emscripten glue loader so it never hits `import('../dist/argon2.js')`.
// We inject a <script> tag pointing at our public copy.
_self.loadArgon2WasmModule = () =>
  new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/argon2-glue.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load argon2 glue script"));
    document.head.appendChild(script);
  });

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
