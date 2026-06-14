import { Check, Settings2, Waypoints } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DecryptedPattern } from "../../hooks/useTreeData";
import { getPatternColor } from "../../lib/patternColors";
import "./PatternFocusMenu.css";

interface PatternFocusMenuProps {
  patterns: Map<string, DecryptedPattern>;
  focusedPatternId: string | null;
  onFocus: (id: string | null) => void;
  // Omitted on read-only surfaces (the public demo) where patterns cannot be managed.
  onManage?: () => void;
}

/**
 * Toolbar dropdown for the canvas pattern spotlight: pick one saved pattern to
 * focus (single-select), clear the focus, or open the pattern manager.
 */
export function PatternFocusMenu({
  patterns,
  focusedPatternId,
  onFocus,
  onManage,
}: PatternFocusMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const list = Array.from(patterns.values());
  const active = focusedPatternId !== null;

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="pattern-focus-menu" ref={ref}>
      <button
        type="button"
        className={`tree-toolbar__icon-btn${active ? " tree-toolbar__icon-btn--active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("pattern.focus.menu")}
      >
        <Waypoints size={14} />
      </button>

      {open && (
        <div className="pattern-focus-menu__dropdown" role="menu">
          {list.length === 0 ? (
            <div className="pattern-focus-menu__empty">{t("pattern.empty")}</div>
          ) : (
            <>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={!active}
                className="pattern-focus-menu__item"
                onClick={() => {
                  onFocus(null);
                  setOpen(false);
                }}
              >
                <span className="pattern-focus-menu__check">{!active && <Check size={13} />}</span>
                <span className="pattern-focus-menu__name">{t("pattern.focus.showAll")}</span>
              </button>
              {list.map((p) => {
                const isFocused = p.id === focusedPatternId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isFocused}
                    className="pattern-focus-menu__item"
                    onClick={() => {
                      onFocus(isFocused ? null : p.id);
                      setOpen(false);
                    }}
                  >
                    <span className="pattern-focus-menu__check">
                      {isFocused && <Check size={13} />}
                    </span>
                    <span
                      className="pattern-focus-menu__dot"
                      style={{ backgroundColor: getPatternColor(p.color) }}
                    />
                    <span className="pattern-focus-menu__name">{p.name}</span>
                  </button>
                );
              })}
            </>
          )}
          {onManage && (
            <button
              type="button"
              className="pattern-focus-menu__manage"
              onClick={() => {
                onManage();
                setOpen(false);
              }}
            >
              <Settings2 size={13} />
              {t("pattern.focus.manage")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
