import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { CanvasSettings } from "../../hooks/useCanvasSettings";
import { useLogout } from "../../hooks/useLogout";
import { SettingsPanel } from "./SettingsPanel";
import type { ActiveView } from "./ViewTabs";
import { ViewTabs } from "./ViewTabs";

interface TreeToolbarProps {
  treeId: string;
  treeName: string | null;
  activeView: ActiveView;
  canvasSettings: CanvasSettings;
  onUpdateSettings: (partial: Partial<CanvasSettings>) => void;
  children?: ReactNode;
}

export function TreeToolbar({
  treeId,
  treeName,
  activeView,
  canvasSettings,
  onUpdateSettings,
  children,
}: TreeToolbarProps) {
  const { t } = useTranslation();
  const logout = useLogout();

  return (
    <div className="tree-toolbar">
      <span className="tree-toolbar__title">{treeName ?? t("tree.untitled")}</span>
      <div className="tree-toolbar__spacer" />

      <ViewTabs treeId={treeId} activeView={activeView} />

      {children && (
        <>
          <div className="tree-toolbar__separator" />
          <div className="tree-toolbar__group">{children}</div>
        </>
      )}

      <div className="tree-toolbar__separator" />

      <div className="tree-toolbar__group">
        <Link to="/trees" className="tree-toolbar__icon-btn" aria-label={t("nav.trees")}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </Link>
        <SettingsPanel
          settings={canvasSettings}
          onUpdate={onUpdateSettings}
          className="tree-toolbar__icon-btn"
        />
        <button
          type="button"
          className="tree-toolbar__icon-btn"
          onClick={logout}
          aria-label={t("nav.logout")}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
