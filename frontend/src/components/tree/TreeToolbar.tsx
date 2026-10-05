import { House, Lock, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useLogout } from "../../hooks/useLogout";
import type { ViewTab } from "./SettingsPanel";
import { SettingsPanel } from "./SettingsPanel";
import type { ActiveView } from "./ViewTabs";
import { ViewTabs } from "./ViewTabs";

interface TreeToolbarProps {
  treeId: string;
  treeName: string | null;
  activeView: ActiveView;
  viewTab: ViewTab;
  children?: ReactNode;
}

export function TreeToolbar({ treeId, treeName, activeView, viewTab, children }: TreeToolbarProps) {
  const { t } = useTranslation();
  const logout = useLogout();

  return (
    <div className="tree-toolbar">
      <span className="tree-toolbar__title">{treeName ?? t("tree.untitled")}</span>
      <ViewTabs treeId={treeId} activeView={activeView} />

      <div className="tree-toolbar__spacer" />

      {children && (
        <>
          <div className="tree-toolbar__group tree-toolbar__extras">{children}</div>
          <div className="tree-toolbar__separator" />
        </>
      )}

      <span className="tree-toolbar__encrypted">
        <Lock size={13} aria-hidden="true" />
        {t("tree.encryptedHere")}
      </span>

      <div className="tree-toolbar__group tree-toolbar__account">
        <Link to="/trees" className="tree-toolbar__icon-btn" aria-label={t("nav.trees")}>
          <House size={14} />
        </Link>
        <SettingsPanel viewTab={viewTab} className="tree-toolbar__icon-btn" />
        <button
          type="button"
          className="tree-toolbar__icon-btn"
          onClick={logout}
          aria-label={t("nav.logout")}
        >
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );
}
