import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import "./i18n";
import "./guest.css";

// Placeholder until the guest viewer lands: it only shows that the page loads.
function GuestApp() {
  const { t } = useTranslation();
  return <p className="guest-loading">{t("common.loading")}</p>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GuestApp />
  </StrictMode>,
);
