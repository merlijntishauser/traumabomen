import { MoreHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface TreeRowMenuProps {
  treeName: string;
  /** Omitted when the tree cannot be renamed (its name could not be decrypted). */
  onRename?: () => void;
  onDelete: () => void;
}

/**
 * Per-row overflow menu for the rare actions on a tree. Opening a tree is
 * the common action and keeps the whole row; rename and delete wait here.
 */
export function TreeRowMenu({ treeName, onRename, onDelete }: TreeRowMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    itemRefs.current.find((el) => el)?.focus();

    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function onMenuKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = itemRefs.current.filter((el): el is HTMLButtonElement => el !== null);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === "ArrowDown" ? 1 : -1;
    items[(index + step + items.length) % items.length]?.focus();
  }

  function choose(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <div className="tree-row-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="tree-row-menu__trigger"
        aria-label={t("tree.optionsFor", { name: treeName })}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open && (
        <div id={menuId} className="tree-row-menu__list" role="menu" onKeyDown={onMenuKeyDown}>
          {onRename && (
            <button
              ref={(el) => {
                itemRefs.current[0] = el;
              }}
              type="button"
              role="menuitem"
              className="tree-row-menu__item"
              onClick={() => choose(onRename)}
            >
              {t("tree.rename")}
            </button>
          )}
          <button
            ref={(el) => {
              itemRefs.current[1] = el;
            }}
            type="button"
            role="menuitem"
            className="tree-row-menu__item tree-row-menu__item--danger"
            onClick={() => choose(onDelete)}
          >
            {t("tree.deleteTree")}
          </button>
        </div>
      )}
    </div>
  );
}
