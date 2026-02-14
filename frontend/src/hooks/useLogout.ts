import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useEncryption } from "../contexts/EncryptionContext";
import { logout } from "../lib/api";

export function useLogout() {
  const navigate = useNavigate();
  const { clearKey } = useEncryption();

  return useCallback(() => {
    logout();
    clearKey();
    navigate("/login");
  }, [clearKey, navigate]);
}
