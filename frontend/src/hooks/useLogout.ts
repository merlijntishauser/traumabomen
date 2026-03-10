import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useEncryption } from "../contexts/useEncryption";
import { clearTokens, clearWasAuthenticated, getRefreshToken, logout } from "../lib/api";

export function useLogout() {
  const navigate = useNavigate();
  const { clearKey } = useEncryption();
  const queryClient = useQueryClient();

  return useCallback(() => {
    const refreshToken = getRefreshToken();
    clearTokens();
    clearWasAuthenticated();
    clearKey();
    queryClient.clear();
    navigate("/login");
    if (refreshToken) {
      void logout(refreshToken);
    }
  }, [clearKey, queryClient, navigate]);
}
