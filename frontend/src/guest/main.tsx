import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import "../styles/theme.css";
import "./guest.css";
import { GuestApp } from "./GuestApp";
import { readStoredTheme } from "./guestTheme";

// The main app's theme setting, read once; the guest page never writes it.
document.documentElement.setAttribute(
  "data-theme",
  readStoredTheme(typeof localStorage === "undefined" ? undefined : localStorage),
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GuestApp />
  </StrictMode>,
);
