import { Routes, Route, Navigate } from "react-router-dom";
import { getAccessToken } from "./lib/api";
import {
  EncryptionProvider,
  useEncryption,
} from "./contexts/EncryptionContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import TreeListPage from "./pages/TreeListPage";
import TreeWorkspacePage from "./pages/TreeWorkspacePage";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { key } = useEncryption();
  if (!getAccessToken() || !key) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <EncryptionProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/trees"
          element={
            <AuthGuard>
              <TreeListPage />
            </AuthGuard>
          }
        />
        <Route
          path="/trees/:id"
          element={
            <AuthGuard>
              <TreeWorkspacePage />
            </AuthGuard>
          }
        />
        <Route path="*" element={<Navigate to="/trees" replace />} />
      </Routes>
    </EncryptionProvider>
  );
}
