import { use } from "react";
import { EncryptionContext } from "./EncryptionContext";

export function useEncryption() {
  const context = use(EncryptionContext);
  if (!context) {
    throw new Error("useEncryption must be used within an EncryptionProvider");
  }
  return context;
}
