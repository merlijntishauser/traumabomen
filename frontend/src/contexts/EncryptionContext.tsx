import { createContext, type ReactNode, useCallback, useMemo, useState } from "react";
import { decryptFromApi, encryptForApi, hashPassphrase, timingSafeEqual } from "../lib/crypto";

interface EncryptionContextValue {
  masterKey: CryptoKey | null;
  treeKeys: Map<string, CryptoKey>;
  keyRingBase64: Map<string, string>;
  passphraseHash: string | null;
  isMigrated: boolean;
  setMasterKey: (key: CryptoKey) => void;
  setTreeKeys: (keys: Map<string, CryptoKey>) => void;
  setKeyRingBase64: (map: Map<string, string>) => void;
  addTreeKey: (treeId: string, key: CryptoKey, base64: string) => void;
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

export const EncryptionContext = createContext<EncryptionContextValue | null>(null);

export function EncryptionProvider({ children }: { children: ReactNode }) {
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [treeKeys, setTreeKeys] = useState<Map<string, CryptoKey>>(new Map());
  const [keyRingBase64, setKeyRingBase64] = useState<Map<string, string>>(new Map());
  const [passphraseHash, setPassphraseHash] = useState<string | null>(null);
  const [isMigrated, setIsMigrated] = useState(false);

  const addTreeKey = useCallback((treeId: string, key: CryptoKey, base64: string) => {
    setTreeKeys((prev) => {
      const next = new Map(prev);
      next.set(treeId, key);
      return next;
    });
    setKeyRingBase64((prev) => {
      const next = new Map(prev);
      next.set(treeId, base64);
      return next;
    });
  }, []);

  const removeTreeKey = useCallback((treeId: string) => {
    setTreeKeys((prev) => {
      const next = new Map(prev);
      next.delete(treeId);
      return next;
    });
    setKeyRingBase64((prev) => {
      const next = new Map(prev);
      next.delete(treeId);
      return next;
    });
  }, []);

  const clearKey = useCallback(() => {
    setMasterKey(null);
    setTreeKeys(new Map());
    setKeyRingBase64(new Map());
    setPassphraseHash(null);
    setIsMigrated(false);
  }, []);

  const verifyPassphrase = useCallback(
    async (passphrase: string): Promise<boolean> => {
      if (!passphraseHash) return false;
      const hash = await hashPassphrase(passphrase);
      return timingSafeEqual(hash, passphraseHash);
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
      keyRingBase64,
      passphraseHash,
      isMigrated,
      setMasterKey,
      setTreeKeys,
      setKeyRingBase64,
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
      keyRingBase64,
      passphraseHash,
      isMigrated,
      addTreeKey,
      removeTreeKey,
      clearKey,
      verifyPassphrase,
      encrypt,
      decrypt,
      masterEncrypt,
      masterDecrypt,
    ],
  );

  return <EncryptionContext.Provider value={value}>{children}</EncryptionContext.Provider>;
}
