import { Settings, Shield, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AutoLockSection } from "./settings/AutoLockSection";
import { ChangePassphraseSection } from "./settings/ChangePassphraseSection";
import { ChangePasswordSection } from "./settings/ChangePasswordSection";
import { DeleteAccountSection } from "./settings/DeleteAccountSection";
import { PassphraseHintSection } from "./settings/PassphraseHintSection";
import "./SettingsPanel.css";

export interface ViewTab {
  label: string;
  content: ReactNode;
}

interface Props {
  viewTab: ViewTab;
  className?: string;
}

type TabId = "view" | "security" | "delete";

interface SidebarTab {
  id: TabId;
  label: string;
  icon: ReactNode;
  danger?: boolean;
}

export function SettingsPanel({ viewTab, className }: Props) {
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("view");
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) setOpen(false);
  }

  function handleOpen() {
    setTab("view");
    setOpen(true);
  }

  const tabs: SidebarTab[] = [
    { id: "view", label: viewTab.label, icon: <Settings size={16} /> },
    { id: "security", label: t("settings.security"), icon: <Shield size={16} /> },
    { id: "delete", label: t("settings.deleteAccount"), icon: <Trash2 size={16} />, danger: true },
  ];

  return (
    <>
      <button
        type="button"
        className={`settings-panel__trigger ${className ?? ""}`}
        onClick={handleOpen}
        aria-label={t("settings.title")}
      >
        <Settings size={14} />
      </button>

      {open &&
        createPortal(
          <div
            className="settings-modal__backdrop"
            onClick={handleBackdropClick}
            role="presentation"
          >
            <div
              ref={modalRef}
              className="settings-modal"
              role="dialog"
              aria-modal="true"
              aria-label={t("settings.title")}
            >
              <div className="settings-modal__sidebar">
                <h2 className="settings-modal__title">{t("settings.title")}</h2>
                <nav className="settings-modal__nav">
                  {tabs.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`settings-modal__nav-item${tab === item.id ? " settings-modal__nav-item--active" : ""}${item.danger ? " settings-modal__nav-item--danger" : ""}`}
                      onClick={() => setTab(item.id)}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="settings-modal__content">
                <button
                  type="button"
                  className="settings-modal__close"
                  onClick={() => setOpen(false)}
                  aria-label={t("common.close")}
                >
                  <X size={18} />
                </button>

                {tab === "view" && viewTab.content}

                {tab === "security" && (
                  <>
                    <ChangePasswordSection />
                    <div className="settings-panel__divider" />
                    <ChangePassphraseSection />
                    <div className="settings-panel__divider" />
                    <PassphraseHintSection />
                    <div className="settings-panel__divider" />
                    <AutoLockSection />
                  </>
                )}

                {tab === "delete" && <DeleteAccountSection />}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
