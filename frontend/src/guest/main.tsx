import { lazy, StrictMode, Suspense, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import type { GuestTreeState } from "../lib/guestCopy";
import "./i18n";
import "../styles/theme.css";
import "./guest.css";

const GuestTreeView = lazy(() =>
  import("./GuestTreeView").then((module) => ({ default: module.GuestTreeView })),
);

interface OpenedCopy {
  state: GuestTreeState;
  publishedAt: string;
}

// Placeholder until the guest flow lands: it only shows that the page loads.
// The open flow will set the opened copy once the passphrase has been checked.
function GuestApp() {
  const { t } = useTranslation();
  const [opened] = useState<OpenedCopy | null>(null);
  if (opened) {
    return (
      <Suspense fallback={<p className="guest-loading">{t("common.loading")}</p>}>
        <GuestTreeView state={opened.state} publishedAt={opened.publishedAt} />
      </Suspense>
    );
  }
  return <p className="guest-loading">{t("common.loading")}</p>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GuestApp />
  </StrictMode>,
);
