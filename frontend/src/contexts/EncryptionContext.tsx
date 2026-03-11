import { createContext, type ReactNode, useCallback, useMemo, useReducer } from "react";
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

// ---------------------------------------------------------------------------
// Reducer state & actions
// ---------------------------------------------------------------------------

interface EncryptionState {
  masterKey: CryptoKey | null;
  treeKeys: Map<string, CryptoKey>;
  keyRingBase64: Map<string, string>;
  passphraseHash: string | null;
  isMigrated: boolean;
}

type EncryptionAction =
  | { type: "SET_MASTER_KEY"; key: CryptoKey }
  | { type: "SET_TREE_KEYS"; keys: Map<string, CryptoKey> }
  | { type: "SET_KEY_RING_BASE64"; map: Map<string, string> }
  | { type: "SET_PASSPHRASE_HASH"; hash: string }
  | { type: "SET_IS_MIGRATED"; value: boolean }
  | { type: "ADD_TREE_KEY"; treeId: string; key: CryptoKey; base64: string }
  | { type: "REMOVE_TREE_KEY"; treeId: string }
  | { type: "CLEAR" };

const initialState: EncryptionState = {
  masterKey: null,
  treeKeys: new Map(),
  keyRingBase64: new Map(),
  passphraseHash: null,
  isMigrated: false,
};

function encryptionReducer(state: EncryptionState, action: EncryptionAction): EncryptionState {
  switch (action.type) {
    case "SET_MASTER_KEY":
      return { ...state, masterKey: action.key };
    case "SET_TREE_KEYS":
      return { ...state, treeKeys: action.keys };
    case "SET_KEY_RING_BASE64":
      return { ...state, keyRingBase64: action.map };
    case "SET_PASSPHRASE_HASH":
      return { ...state, passphraseHash: action.hash };
    case "SET_IS_MIGRATED":
      return { ...state, isMigrated: action.value };
    case "ADD_TREE_KEY": {
      const nextTreeKeys = new Map(state.treeKeys);
      nextTreeKeys.set(action.treeId, action.key);
      const nextKeyRing = new Map(state.keyRingBase64);
      nextKeyRing.set(action.treeId, action.base64);
      return { ...state, treeKeys: nextTreeKeys, keyRingBase64: nextKeyRing };
    }
    case "REMOVE_TREE_KEY": {
      const nextTreeKeys = new Map(state.treeKeys);
      nextTreeKeys.delete(action.treeId);
      const nextKeyRing = new Map(state.keyRingBase64);
      nextKeyRing.delete(action.treeId);
      return { ...state, treeKeys: nextTreeKeys, keyRingBase64: nextKeyRing };
    }
    case "CLEAR":
      return { ...initialState, treeKeys: new Map(), keyRingBase64: new Map() };
  }
}

// ---------------------------------------------------------------------------
// Context & Provider
// ---------------------------------------------------------------------------

export const EncryptionContext = createContext<EncryptionContextValue | null>(null);

export function EncryptionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(encryptionReducer, initialState);

  const setMasterKey = useCallback(
    (key: CryptoKey) => dispatch({ type: "SET_MASTER_KEY", key }),
    [],
  );

  const setTreeKeys = useCallback(
    (keys: Map<string, CryptoKey>) => dispatch({ type: "SET_TREE_KEYS", keys }),
    [],
  );

  const setKeyRingBase64 = useCallback(
    (map: Map<string, string>) => dispatch({ type: "SET_KEY_RING_BASE64", map }),
    [],
  );

  const setPassphraseHash = useCallback(
    (hash: string) => dispatch({ type: "SET_PASSPHRASE_HASH", hash }),
    [],
  );

  const setIsMigrated = useCallback(
    (value: boolean) => dispatch({ type: "SET_IS_MIGRATED", value }),
    [],
  );

  const addTreeKey = useCallback(
    (treeId: string, key: CryptoKey, base64: string) =>
      dispatch({ type: "ADD_TREE_KEY", treeId, key, base64 }),
    [],
  );

  const removeTreeKey = useCallback(
    (treeId: string) => dispatch({ type: "REMOVE_TREE_KEY", treeId }),
    [],
  );

  const clearKey = useCallback(() => dispatch({ type: "CLEAR" }), []);

  const verifyPassphrase = useCallback(
    async (passphrase: string): Promise<boolean> => {
      if (!state.passphraseHash) return false;
      const hash = await hashPassphrase(passphrase);
      return timingSafeEqual(hash, state.passphraseHash);
    },
    [state.passphraseHash],
  );

  const encrypt = useCallback(
    async (data: unknown, treeId: string): Promise<string> => {
      const treeKey = state.treeKeys.get(treeId);
      if (!treeKey) throw new Error(`No encryption key for tree ${treeId}`);
      return encryptForApi(data, treeKey);
    },
    [state.treeKeys],
  );

  const decrypt = useCallback(
    async <T,>(encryptedData: string, treeId: string): Promise<T> => {
      const treeKey = state.treeKeys.get(treeId);
      if (!treeKey) throw new Error(`No encryption key for tree ${treeId}`);
      return decryptFromApi<T>(encryptedData, treeKey);
    },
    [state.treeKeys],
  );

  const masterEncrypt = useCallback(
    async (data: unknown): Promise<string> => {
      if (!state.masterKey) throw new Error("No master key available");
      return encryptForApi(data, state.masterKey);
    },
    [state.masterKey],
  );

  const masterDecrypt = useCallback(
    async <T,>(encryptedData: string): Promise<T> => {
      if (!state.masterKey) throw new Error("No master key available");
      return decryptFromApi<T>(encryptedData, state.masterKey);
    },
    [state.masterKey],
  );

  const value = useMemo(
    () => ({
      masterKey: state.masterKey,
      treeKeys: state.treeKeys,
      keyRingBase64: state.keyRingBase64,
      passphraseHash: state.passphraseHash,
      isMigrated: state.isMigrated,
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
      state.masterKey,
      state.treeKeys,
      state.keyRingBase64,
      state.passphraseHash,
      state.isMigrated,
      addTreeKey,
      removeTreeKey,
      clearKey,
      setMasterKey,
      setTreeKeys,
      setKeyRingBase64,
      setPassphraseHash,
      setIsMigrated,
      verifyPassphrase,
      encrypt,
      decrypt,
      masterEncrypt,
      masterDecrypt,
    ],
  );

  return <EncryptionContext.Provider value={value}>{children}</EncryptionContext.Provider>;
}
