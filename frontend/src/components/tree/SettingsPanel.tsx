import { Settings } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
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

export function SettingsPanel({ viewTab, className }: Props) {
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const [tab, setTab] = useState<"view" | "account">("view");

  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as Node;
    if (
      triggerRef.current &&
      !triggerRef.current.contains(target) &&
      dropdownRef.current &&
      !dropdownRef.current.contains(target)
    ) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside, true);
      return () => document.removeEventListener("mousedown", handleClickOutside, true);
    }
  }, [open, handleClickOutside]);

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [open]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`settings-panel__trigger ${className ?? ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={t("settings.title")}
      >
        <Settings size={14} />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="settings-panel__dropdown"
            style={{ top: pos.top, right: pos.right }}
          >
            <div className="settings-panel__tabs">
              <button
                type="button"
                className={`settings-panel__tab ${tab === "view" ? "settings-panel__tab--active" : ""}`}
                onClick={() => setTab("view")}
              >
                {viewTab.label}
              </button>
              <button
                type="button"
                className={`settings-panel__tab ${tab === "account" ? "settings-panel__tab--active" : ""}`}
                onClick={() => setTab("account")}
              >
                {t("settings.account")}
              </button>
            </div>

            <div className="settings-panel__content">
              {tab === "view" && viewTab.content}

              {tab === "account" && (
                <>
                  <ChangePasswordSection />
                  <div className="settings-panel__divider" />
                  <ChangePassphraseSection />
                  <div className="settings-panel__divider" />
                  <PassphraseHintSection />
                  <div className="settings-panel__divider" />
                  <AutoLockSection />
                  <div className="settings-panel__divider" />
                  <DeleteAccountSection />
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
