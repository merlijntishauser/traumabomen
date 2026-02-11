declare module "argon2-browser" {
  interface Argon2HashResult {
    hash: Uint8Array;
    hashHex: string;
    encoded: string;
  }

  interface Argon2HashOptions {
    pass: string | Uint8Array;
    salt: string | Uint8Array;
    time?: number;
    mem?: number;
    hashLen?: number;
    parallelism?: number;
    type?: number;
  }

  const ArgonType: {
    Argon2d: 0;
    Argon2i: 1;
    Argon2id: 2;
  };

  function hash(options: Argon2HashOptions): Promise<Argon2HashResult>;

  export { ArgonType, hash, Argon2HashOptions, Argon2HashResult };
}
