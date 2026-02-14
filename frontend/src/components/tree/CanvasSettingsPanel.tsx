import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { CanvasSettings, EdgeStyle } from "../../hooks/useCanvasSettings";
import "./CanvasSettingsPanel.css";

interface Props {
  settings: CanvasSettings;
  onUpdate: (partial: Partial<CanvasSettings>) => void;
  className?: string;
}

const EDGE_STYLES: EdgeStyle[] = ["curved", "elbows", "straight"];

export function CanvasSettingsPanel({ settings, onUpdate, className }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

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
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
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
        className={`canvas-settings__trigger ${className ?? ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={t("canvas.settings")}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM5.754 8a2.246 2.246 0 114.492 0 2.246 2.246 0 01-4.492 0z" />
          <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 01-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 01-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 01.52 1.255l-.16.292c-.892 1.64.902 3.434 2.541 2.54l.292-.159a.873.873 0 011.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 011.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 01.52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 01-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 01-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 002.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 001.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 00-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 00-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 00-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291a1.873 1.873 0 00-1.116-2.693l-.318-.094c-.835-.246-.835-1.428 0-1.674l.319-.094a1.873 1.873 0 001.115-2.692l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 002.692-1.116l.094-.318z" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="canvas-settings__dropdown"
            style={{ top: pos.top, right: pos.right }}
          >
            <label className="canvas-settings__toggle">
              <input
                type="checkbox"
                checked={settings.showGrid}
                onChange={(e) => onUpdate({ showGrid: e.target.checked })}
              />
              <span>{t("canvas.showGrid")}</span>
            </label>

            <label className="canvas-settings__toggle">
              <input
                type="checkbox"
                checked={settings.snapToGrid}
                onChange={(e) => onUpdate({ snapToGrid: e.target.checked })}
              />
              <span>{t("canvas.snapToGrid")}</span>
            </label>

            <div className="canvas-settings__divider" />

            <div className="canvas-settings__group">
              <span className="canvas-settings__label">{t("canvas.edgeStyle")}</span>
              <div className="canvas-settings__radios">
                {EDGE_STYLES.map((style) => (
                  <label key={style} className="canvas-settings__radio">
                    <input
                      type="radio"
                      name="edgeStyle"
                      value={style}
                      checked={settings.edgeStyle === style}
                      onChange={() => onUpdate({ edgeStyle: style })}
                    />
                    <span>{t(`canvas.edgeStyle.${style}`)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="canvas-settings__divider" />

            <label className="canvas-settings__toggle">
              <input
                type="checkbox"
                checked={settings.showMarkers}
                onChange={(e) => onUpdate({ showMarkers: e.target.checked })}
              />
              <span>{t("canvas.showMarkers")}</span>
            </label>

            <label className="canvas-settings__toggle">
              <input
                type="checkbox"
                checked={settings.showMinimap}
                onChange={(e) => onUpdate({ showMinimap: e.target.checked })}
              />
              <span>{t("canvas.showMinimap")}</span>
            </label>
          </div>,
          document.body,
        )}
    </>
  );
}
