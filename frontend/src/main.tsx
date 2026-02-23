import * as Sentry from "@sentry/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/theme.css";
import "./i18n";
import App from "./App";

function stripSensitiveBreadcrumbs(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  for (const crumb of event.breadcrumbs ?? []) {
    if (!crumb.data || typeof crumb.data !== "object") continue;
    for (const key of Object.keys(crumb.data)) {
      if (key.includes("encrypt") || key.includes("passphrase")) {
        (crumb.data as Record<string, unknown>)[key] = "[filtered]";
      }
    }
  }
  return event;
}

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "development",
    release: import.meta.env.VITE_SENTRY_RELEASE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: stripSensitiveBreadcrumbs,
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </Suspense>
  </StrictMode>,
);
