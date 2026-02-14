import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppFooter } from "./components/AppFooter";
import { MentalHealthBanner } from "./components/MentalHealthBanner";
import { MobileBanner } from "./components/MobileBanner";
import { EncryptionProvider, useEncryption } from "./contexts/EncryptionContext";
import { getAccessToken, getIsAdmin } from "./lib/api";
import "./components/MobileBanner.css";
import AdminPage from "./pages/AdminPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import TimelinePage from "./pages/TimelinePage";
import TreeListPage from "./pages/TreeListPage";
import TreeWorkspacePage from "./pages/TreeWorkspacePage";
import UnlockPage from "./pages/UnlockPage";
import VerificationPendingPage from "./pages/VerificationPendingPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { key } = useEncryption();
  const location = useLocation();
  if (!getAccessToken()) {
    return <Navigate to="/login" replace />;
  }
  if (!key) {
    return <Navigate to="/unlock" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  if (!getAccessToken() || !getIsAdmin()) {
    return <Navigate to="/trees" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <EncryptionProvider>
      <div className="app-layout">
        <MentalHealthBanner />
        <MobileBanner />
        <main className="app-main">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-pending" element={<VerificationPendingPage />} />
            <Route path="/verify" element={<VerifyEmailPage />} />
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
            <Route
              path="/admin"
              element={
                <AdminGuard>
                  <AdminPage />
                </AdminGuard>
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
