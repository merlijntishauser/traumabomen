import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { encryptForApi, decryptFromApi } from "../lib/crypto";

interface EncryptionContextValue {
  key: CryptoKey | null;
  setKey: (key: CryptoKey) => void;
  clearKey: () => void;
  encrypt: (data: unknown) => Promise<string>;
  decrypt: <T>(encryptedData: string) => Promise<T>;
}

const EncryptionContext = createContext<EncryptionContextValue | null>(null);

export function EncryptionProvider({ children }: { children: ReactNode }) {
  const [key, setKeyState] = useState<CryptoKey | null>(null);

  const setKey = useCallback((newKey: CryptoKey) => {
    setKeyState(newKey);
  }, []);

  const clearKey = useCallback(() => {
    setKeyState(null);
  }, []);

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
    () => ({ key, setKey, clearKey, encrypt, decrypt }),
    [key, setKey, clearKey, encrypt, decrypt],
  );

  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryption(): EncryptionContextValue {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error("useEncryption must be used within an EncryptionProvider");
  }
  return context;
}
