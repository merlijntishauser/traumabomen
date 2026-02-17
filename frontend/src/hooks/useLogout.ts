import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useEncryption } from "../contexts/EncryptionContext";
import { logout } from "../lib/api";

export function useLogout() {
  const navigate = useNavigate();
  const { clearKey } = useEncryption();
  const queryClient = useQueryClient();

  return useCallback(() => {
    logout();
    clearKey();
    queryClient.clear();
    navigate("/login");
  }, [clearKey, queryClient, navigate]);
}
