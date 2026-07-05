import { Circle, Square, Star, Trash2, Triangle, User } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RelatedPersonKind } from "../../lib/relatedPersonPlan";
import type { PersonDetailSection } from "./PersonDetailPanel";
import "./NodeContextMenu.css";

const MENU_WIDTH = 220;
// Approximate menu height for the flip decision; the real height is measured
// after mount, but this seeds the initial (pre-paint) placement.
const MENU_HEIGHT_ESTIMATE = 380;

interface NodeContextMenuProps {
  personId: string;
  x: number;
  y: number;
  onOpenSection: (personId: string, section: PersonDetailSection) => void;
  onOpenDetails: (personId: string) => void;
  onAddRelated: (personId: string, kind: RelatedPersonKind) => void;
  onDelete: (personId: string) => void;
  onClose: () => void;
}

export function NodeContextMenu({
  personId,
  x,
  y,
  onOpenSection,
  onOpenDetails,
  onAddRelated,
  onDelete,
  onClose,
}: NodeContextMenuProps) {
  const { t } = useTranslation();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pos, setPos] = useState(() => flip(x, y, MENU_WIDTH, MENU_HEIGHT_ESTIMATE));

  // Re-measure once mounted so the flip uses the true size (skip when the
  // layout box is unavailable, e.g. jsdom, keeping the estimate-based flip).
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el || el.offsetWidth === 0) return;
    setPos(flip(x, y, el.offsetWidth, el.offsetHeight));
  }, [x, y]);

  // Dismiss on outside-click and Escape. Canvas pan/zoom already dispatches
  // DISMISS_ALL, which unmounts this component.
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const section = (s: PersonDetailSection) => () => {
    onOpenSection(personId, s);
    onClose();
  };
  const related = (kind: RelatedPersonKind) => () => {
    onAddRelated(personId, kind);
    onClose();
  };

  return (
    <div ref={menuRef} className="node-menu" style={{ left: pos.left, top: pos.top }} role="menu">
      <button
        type="button"
        className="node-menu__item"
        role="menuitem"
        onClick={section("trauma_event")}
      >
        <Circle size={13} className="node-menu__icon node-menu__icon--trauma" />
        {t("nodeMenu.addTrauma")}
      </button>
      <button
        type="button"
        className="node-menu__item"
        role="menuitem"
        onClick={section("life_event")}
      >
        <Square size={13} className="node-menu__icon node-menu__icon--life" />
        {t("nodeMenu.addLifeEvent")}
      </button>
      <button
        type="button"
        className="node-menu__item"
        role="menuitem"
        onClick={section("turning_point")}
      >
        <Star size={13} className="node-menu__icon node-menu__icon--turning" />
        {t("nodeMenu.addTurningPoint")}
      </button>
      <button
        type="button"
        className="node-menu__item"
        role="menuitem"
        onClick={section("classification")}
      >
        <Triangle size={13} className="node-menu__icon node-menu__icon--classification" />
        {t("nodeMenu.addClassification")}
      </button>

      <div className="node-menu__divider" />

      <button
        type="button"
        className="node-menu__item"
        role="menuitem"
        onClick={related("sibling")}
      >
        {t("nodeMenu.addSibling")}
      </button>
      <button
        type="button"
        className="node-menu__item"
        role="menuitem"
        onClick={related("partner")}
      >
        {t("nodeMenu.addPartner")}
      </button>
      <button type="button" className="node-menu__item" role="menuitem" onClick={related("parent")}>
        {t("nodeMenu.addParent")}
      </button>
      <button type="button" className="node-menu__item" role="menuitem" onClick={related("child")}>
        {t("nodeMenu.addChild")}
      </button>

      <div className="node-menu__divider" />

      <button
        type="button"
        className="node-menu__item"
        role="menuitem"
        onClick={() => {
          onOpenDetails(personId);
          onClose();
        }}
      >
        <User size={13} className="node-menu__icon" />
        {t("nodeMenu.openDetails")}
      </button>
      {confirmDelete ? (
        <div className="node-menu__confirm">
          <button
            type="button"
            className="node-menu__item node-menu__item--danger"
            onClick={() => {
              onDelete(personId);
              onClose();
            }}
          >
            <Trash2 size={13} className="node-menu__icon" />
            {t("nodeMenu.confirmDelete")}
          </button>
          <button
            type="button"
            className="node-menu__item node-menu__item--muted"
            onClick={() => setConfirmDelete(false)}
          >
            {t("common.cancel")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="node-menu__item node-menu__item--danger"
          role="menuitem"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 size={13} className="node-menu__icon" />
          {t("nodeMenu.deletePerson")}
        </button>
      )}
    </div>
  );
}

interface NodeMenuState {
  nodeId: string;
  x: number;
  y: number;
}

/**
 * Guard, glue, and render for the node context menu, kept out of the workspace
 * component. Owns the small panel wiring (select person, open a section's
 * new-entry form, open details) so the workspace only passes primitives.
 * Renders nothing unless a menu is open on an existing person.
 */
export function NodeContextMenuHost({
  menu,
  hasPerson,
  selectPerson,
  openSection,
  markCreateNew,
  clearPatternPanel,
  onAddRelated,
  onDelete,
  onClose,
}: {
  menu: NodeMenuState | null;
  hasPerson: (id: string) => boolean;
  selectPerson: (id: string) => void;
  openSection: (section: PersonDetailSection) => void;
  markCreateNew: () => void;
  clearPatternPanel: () => void;
  onAddRelated: (id: string, kind: RelatedPersonKind) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  if (!menu || !hasPerson(menu.nodeId)) return null;
  return (
    <NodeContextMenu
      personId={menu.nodeId}
      x={menu.x}
      y={menu.y}
      onOpenSection={(id, section) => {
        selectPerson(id);
        openSection(section);
        markCreateNew();
        clearPatternPanel();
      }}
      onOpenDetails={(id) => {
        selectPerson(id);
        openSection(null);
        clearPatternPanel();
      }}
      onAddRelated={onAddRelated}
      onDelete={onDelete}
      onClose={onClose}
    />
  );
}

/** Flip the menu up/left when it would overflow the viewport. */
function flip(x: number, y: number, w: number, h: number): { left: number; top: number } {
  const margin = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = x + w + margin > vw ? Math.max(margin, x - w) : x;
  const top = y + h + margin > vh ? Math.max(margin, y - h) : y;
  return { left, top };
}
