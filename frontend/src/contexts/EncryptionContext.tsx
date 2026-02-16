import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { decryptFromApi, encryptForApi, hashPassphrase } from "../lib/crypto";

interface EncryptionContextValue {
  key: CryptoKey | null;
  passphraseHash: string | null;
  setKey: (key: CryptoKey) => void;
  clearKey: () => void;
  setPassphraseHash: (hash: string) => void;
  verifyPassphrase: (passphrase: string) => Promise<boolean>;
  encrypt: (data: unknown) => Promise<string>;
  decrypt: <T>(encryptedData: string) => Promise<T>;
}

const EncryptionContext = createContext<EncryptionContextValue | null>(null);

export function EncryptionProvider({ children }: { children: ReactNode }) {
  const [key, setKeyState] = useState<CryptoKey | null>(null);
  const [passphraseHash, setPassphraseHashState] = useState<string | null>(null);

  const setKey = useCallback((newKey: CryptoKey) => {
    setKeyState(newKey);
  }, []);

  const clearKey = useCallback(() => {
    setKeyState(null);
    setPassphraseHashState(null);
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
    async (data: unknown): Promise<string> => {
      if (!key) throw new Error("No encryption key available");
      return encryptForApi(data, key);
    },
    [key],
  );

  const decrypt = useCallback(
    async <T,>(encryptedData: string): Promise<T> => {
      if (!key) throw new Error("No encryption key available");
      return decryptFromApi<T>(encryptedData, key);
    },
    [key],
  );

  const value = useMemo(
    () => ({
      key,
      passphraseHash,
      setKey,
      clearKey,
      setPassphraseHash,
      verifyPassphrase,
      encrypt,
      decrypt,
    }),
    [key, passphraseHash, setKey, clearKey, setPassphraseHash, verifyPassphrase, encrypt, decrypt],
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
