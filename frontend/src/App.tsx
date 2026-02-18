import { useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppFooter } from "./components/AppFooter";
import { LockScreen } from "./components/LockScreen";
import { MentalHealthBanner } from "./components/MentalHealthBanner";
import { MobileBanner } from "./components/MobileBanner";
import { OnboardingGate } from "./components/OnboardingGate";
import { EncryptionProvider, useEncryption } from "./contexts/EncryptionContext";
import { useLockScreen } from "./hooks/useLockScreen";
import { useLogout } from "./hooks/useLogout";
import { getAccessToken, getIsAdmin, getOnboardingFlag } from "./lib/api";
import "./components/MobileBanner.css";
import LoginPage from "./pages/LoginPage";
import PrivacyPage from "./pages/PrivacyPage";
import RegisterPage from "./pages/RegisterPage";
import TreeListPage from "./pages/TreeListPage";
import UnlockPage from "./pages/UnlockPage";
import VerificationPendingPage from "./pages/VerificationPendingPage";
import VerifyEmailPage from "./pages/VerifyEmailPage";
import WaitlistPage from "./pages/WaitlistPage";

const AdminPage = lazy(() => import("./pages/AdminPage"));
const PatternPage = lazy(() => import("./pages/PatternPage"));
const TimelinePage = lazy(() => import("./pages/TimelinePage"));
const TreeWorkspacePage = lazy(() => import("./pages/TreeWorkspacePage"));

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

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { key } = useEncryption();
  const [acknowledged, setAcknowledged] = useState(getOnboardingFlag);
  const isAuthenticated = !!getAccessToken();

  // Re-sync with localStorage: login() updates the flag after this component
  // has already mounted with the stale pre-login value.
  const flagFromStorage = getOnboardingFlag();
  if (flagFromStorage && !acknowledged) {
    setAcknowledged(true);
  }

  if (isAuthenticated && key && !acknowledged) {
    return <OnboardingGate onAcknowledged={() => setAcknowledged(true)} />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { key, clearKey, verifyPassphrase } = useEncryption();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleFullLock = useCallback(() => {
    clearKey();
    queryClient.clear();
    navigate("/unlock", { replace: true });
  }, [clearKey, queryClient, navigate]);

  const { lockLevel, wrongAttempts, lock, unlock, failedAttempt } = useLockScreen({
    enabled: key !== null,
    onFullLock: handleFullLock,
  });

  const handleLogout = useLogout();

  const handleLockUnlock = useCallback(
    async (passphrase: string) => {
      const valid = await verifyPassphrase(passphrase);
      if (valid) {
        unlock();
      } else {
        failedAttempt();
      }
    },
    [verifyPassphrase, unlock, failedAttempt],
  );

  return (
    <OnboardingGuard>
      {lockLevel === "blur" && (
        <LockScreen
          wrongAttempts={wrongAttempts}
          onUnlock={handleLockUnlock}
          onLogout={handleLogout}
        />
      )}
      <div className="app-layout">
        <MentalHealthBanner />
        <MobileBanner />
        <main className="app-main">
          <Suspense fallback={null}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/waitlist" element={<WaitlistPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
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
                path="/trees/:id/patterns"
                element={
                  <AuthGuard>
                    <PatternPage />
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
          </Suspense>
        </main>
        <AppFooter onLock={key ? lock : undefined} />
      </div>
    </OnboardingGuard>
  );
}

export default function App() {
  return (
    <EncryptionProvider>
      <AppContent />
    </EncryptionProvider>
  );
}
