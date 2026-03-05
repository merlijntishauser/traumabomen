import * as Sentry from "@sentry/react";
import { useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppFooter } from "./components/AppFooter";
import { LockScreen } from "./components/LockScreen";
import { MentalHealthBanner } from "./components/MentalHealthBanner";
import { MobileBanner } from "./components/MobileBanner";
import { OnboardingGate } from "./components/OnboardingGate";
import { EncryptionProvider } from "./contexts/EncryptionContext";
import { useEncryption } from "./contexts/useEncryption";
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

const RELOAD_KEY = "traumabomen_chunk_reload";

/**
 * Wrap a dynamic import so that a failed chunk load (stale deploy) triggers
 * a single full page reload. Uses sessionStorage to prevent infinite loops.
 */
function lazyWithReload(importFn: () => Promise<{ default: React.ComponentType }>) {
  return lazy(() =>
    importFn().catch(() => {
      const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY); // privacy-ok: non-sensitive reload flag
      if (!alreadyReloaded) {
        sessionStorage.setItem(RELOAD_KEY, "1"); // privacy-ok
        window.location.reload();
        return new Promise<never>(() => {}); // never resolves; page is reloading
      }
      sessionStorage.removeItem(RELOAD_KEY); // privacy-ok
      return Promise.reject(new Error("Failed to load page after reload"));
    }),
  );
}

const AdminPage = lazyWithReload(() => import("./pages/AdminPage"));
const InsightsPage = lazyWithReload(() => import("./pages/InsightsPage"));
const JournalPage = lazyWithReload(() => import("./pages/JournalPage"));
const PatternPage = lazyWithReload(() => import("./pages/PatternPage"));
const TimelinePage = lazyWithReload(() => import("./pages/TimelinePage"));
const TreeWorkspacePage = lazyWithReload(() => import("./pages/TreeWorkspacePage"));

export function ErrorFallback() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontFamily: "var(--font-heading)", marginBottom: "1rem" }}>
        {t("error.title", "Something went wrong")}
      </h1>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: "1.5rem" }}>
        {t("error.description", "An unexpected error occurred. Please reload the page.")}
      </p>
      <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
        {t("error.reload", "Reload page")}
      </button>
    </div>
  );
}

export function LazyBoundary({ children }: { children: React.ReactNode }) {
  return <Sentry.ErrorBoundary fallback={<ErrorFallback />}>{children}</Sentry.ErrorBoundary>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { masterKey } = useEncryption();
  const location = useLocation();
  if (!getAccessToken()) {
    return <Navigate to="/login" replace />;
  }
  if (!masterKey) {
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

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { masterKey } = useEncryption();
  const [acknowledged, setAcknowledged] = useState(getOnboardingFlag);
  const isAuthenticated = !!getAccessToken();

  // Re-sync with localStorage: login() updates the flag after this component
  // has already mounted with the stale pre-login value.
  const flagFromStorage = getOnboardingFlag();
  useEffect(() => {
    if (flagFromStorage && !acknowledged) {
      setAcknowledged(true);
    }
  }, [flagFromStorage, acknowledged]);

  if (isAuthenticated && masterKey && !acknowledged) {
    return <OnboardingGate onAcknowledged={() => setAcknowledged(true)} />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { masterKey, clearKey, verifyPassphrase } = useEncryption();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleFullLock = useCallback(() => {
    clearKey();
    queryClient.clear();
    navigate("/unlock", { replace: true });
  }, [clearKey, queryClient, navigate]);

  const { lockLevel, wrongAttempts, lock, unlock, failedAttempt } = useLockScreen({
    enabled: masterKey !== null,
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
                    <LazyBoundary>
                      <TreeWorkspacePage />
                    </LazyBoundary>
                  </AuthGuard>
                }
              />
              <Route
                path="/trees/:id/timeline"
                element={
                  <AuthGuard>
                    <LazyBoundary>
                      <TimelinePage />
                    </LazyBoundary>
                  </AuthGuard>
                }
              />
              <Route
                path="/trees/:id/patterns"
                element={
                  <AuthGuard>
                    <LazyBoundary>
                      <PatternPage />
                    </LazyBoundary>
                  </AuthGuard>
                }
              />
              <Route
                path="/trees/:id/journal"
                element={
                  <AuthGuard>
                    <LazyBoundary>
                      <JournalPage />
                    </LazyBoundary>
                  </AuthGuard>
                }
              />
              <Route
                path="/trees/:id/insights"
                element={
                  <AuthGuard>
                    <LazyBoundary>
                      <InsightsPage />
                    </LazyBoundary>
                  </AuthGuard>
                }
              />
              <Route
                path="/admin"
                element={
                  <AdminGuard>
                    <LazyBoundary>
                      <AdminPage />
                    </LazyBoundary>
                  </AdminGuard>
                }
              />
              <Route path="*" element={<Navigate to="/trees" replace />} />
            </Routes>
          </Suspense>
        </main>
        <AppFooter onLock={masterKey ? lock : undefined} />
      </div>
    </OnboardingGuard>
  );
}

export default function App() {
  // Clear the chunk-reload flag on successful app boot so future deploys can retry.
  sessionStorage.removeItem(RELOAD_KEY); // privacy-ok

  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <EncryptionProvider>
        <AppContent />
      </EncryptionProvider>
    </Sentry.ErrorBoundary>
  );
}
