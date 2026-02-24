import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { decryptFromApi, encryptForApi, hashPassphrase } from "../lib/crypto";

interface EncryptionContextValue {
  masterKey: CryptoKey | null;
  treeKeys: Map<string, CryptoKey>;
  passphraseHash: string | null;
  isMigrated: boolean;
  setMasterKey: (key: CryptoKey) => void;
  setTreeKeys: (keys: Map<string, CryptoKey>) => void;
  addTreeKey: (treeId: string, key: CryptoKey) => void;
  removeTreeKey: (treeId: string) => void;
  setIsMigrated: (value: boolean) => void;
  clearKey: () => void;
  setPassphraseHash: (hash: string) => void;
  verifyPassphrase: (passphrase: string) => Promise<boolean>;
  encrypt: (data: unknown, treeId: string) => Promise<string>;
  decrypt: <T>(encryptedData: string, treeId: string) => Promise<T>;
  masterEncrypt: (data: unknown) => Promise<string>;
  masterDecrypt: <T>(encryptedData: string) => Promise<T>;
}

const EncryptionContext = createContext<EncryptionContextValue | null>(null);

export function EncryptionProvider({ children }: { children: ReactNode }) {
  const [masterKey, setMasterKeyState] = useState<CryptoKey | null>(null);
  const [treeKeys, setTreeKeysState] = useState<Map<string, CryptoKey>>(new Map());
  const [passphraseHash, setPassphraseHashState] = useState<string | null>(null);
  const [isMigrated, setIsMigratedState] = useState(false);

  const setMasterKey = useCallback((newKey: CryptoKey) => {
    setMasterKeyState(newKey);
  }, []);

  const setTreeKeys = useCallback((keys: Map<string, CryptoKey>) => {
    setTreeKeysState(keys);
  }, []);

  const addTreeKey = useCallback((treeId: string, key: CryptoKey) => {
    setTreeKeysState((prev) => {
      const next = new Map(prev);
      next.set(treeId, key);
      return next;
    });
  }, []);

  const removeTreeKey = useCallback((treeId: string) => {
    setTreeKeysState((prev) => {
      const next = new Map(prev);
      next.delete(treeId);
      return next;
    });
  }, []);

  const setIsMigrated = useCallback((value: boolean) => {
    setIsMigratedState(value);
  }, []);

  const clearKey = useCallback(() => {
    setMasterKeyState(null);
    setTreeKeysState(new Map());
    setPassphraseHashState(null);
    setIsMigratedState(false);
  }, []);

  const setPassphraseHash = useCallback((hash: string) => {
    setPassphraseHashState(hash);
  }, []);

  const verifyPassphrase = useCallback(
    async (passphrase: string): Promise<boolean> => {
      if (!passphraseHash) return false;
      const hash = await hashPassphrase(passphrase);
      return hash === passphraseHash;
    },
    [passphraseHash],
  );

  const encrypt = useCallback(
    async (data: unknown, treeId: string): Promise<string> => {
      const treeKey = treeKeys.get(treeId);
      if (!treeKey) throw new Error(`No encryption key for tree ${treeId}`);
      return encryptForApi(data, treeKey);
    },
    [treeKeys],
  );

  const decrypt = useCallback(
    async <T,>(encryptedData: string, treeId: string): Promise<T> => {
      const treeKey = treeKeys.get(treeId);
      if (!treeKey) throw new Error(`No encryption key for tree ${treeId}`);
      return decryptFromApi<T>(encryptedData, treeKey);
    },
    [treeKeys],
  );

  const masterEncrypt = useCallback(
    async (data: unknown): Promise<string> => {
      if (!masterKey) throw new Error("No master key available");
      return encryptForApi(data, masterKey);
    },
    [masterKey],
  );

  const masterDecrypt = useCallback(
    async <T,>(encryptedData: string): Promise<T> => {
      if (!masterKey) throw new Error("No master key available");
      return decryptFromApi<T>(encryptedData, masterKey);
    },
    [masterKey],
  );

  const value = useMemo(
    () => ({
      masterKey,
      treeKeys,
      passphraseHash,
      isMigrated,
      setMasterKey,
      setTreeKeys,
      addTreeKey,
      removeTreeKey,
      setIsMigrated,
      clearKey,
      setPassphraseHash,
      verifyPassphrase,
      encrypt,
      decrypt,
      masterEncrypt,
      masterDecrypt,
    }),
    [
      masterKey,
      treeKeys,
      passphraseHash,
      isMigrated,
      setMasterKey,
      setTreeKeys,
      addTreeKey,
      removeTreeKey,
      setIsMigrated,
      clearKey,
      setPassphraseHash,
      verifyPassphrase,
      encrypt,
      decrypt,
      masterEncrypt,
      masterDecrypt,
    ],
  );

  return <EncryptionContext.Provider value={value}>{children}</EncryptionContext.Provider>;
}

export function useEncryption(): EncryptionContextValue {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error("useEncryption must be used within an EncryptionProvider");
  }
  return context;
}
