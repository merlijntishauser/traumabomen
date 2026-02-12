import { Routes, Route, Navigate } from "react-router-dom";
import { getAccessToken } from "./lib/api";
import {
  EncryptionProvider,
  useEncryption,
} from "./contexts/EncryptionContext";
import { AppFooter } from "./components/AppFooter";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import UnlockPage from "./pages/UnlockPage";
import TreeListPage from "./pages/TreeListPage";
import TreeWorkspacePage from "./pages/TreeWorkspacePage";
import TimelinePage from "./pages/TimelinePage";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { key } = useEncryption();
  if (!getAccessToken()) {
    return <Navigate to="/login" replace />;
  }
  if (!key) {
    return <Navigate to="/unlock" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <EncryptionProvider>
      <div className="app-layout">
        <main className="app-main">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/unlock" element={<UnlockPage />} />
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
            <Route
              path="/trees/:id/timeline"
              element={
                <AuthGuard>
                  <TimelinePage />
                </AuthGuard>
              }
            />
            <Route path="*" element={<Navigate to="/trees" replace />} />
          </Routes>
        </main>
        <AppFooter />
      </div>
    </EncryptionProvider>
  );
}
