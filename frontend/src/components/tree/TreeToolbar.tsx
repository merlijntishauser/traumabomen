import { House, LogOut } from "lucide-react";
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
          <House size={16} />
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
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );
}
