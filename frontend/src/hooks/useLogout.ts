import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../lib/api";
import { useEncryption } from "../contexts/EncryptionContext";

export function useLogout() {
  const navigate = useNavigate();
  const { clearKey } = useEncryption();

  return useCallback(() => {
    logout();
    clearKey();
    navigate("/login");
  }, [clearKey, navigate]);
}
