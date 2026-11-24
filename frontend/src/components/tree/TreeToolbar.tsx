import { Eye, House, Lock, LogOut } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { useLogout } from "../../hooks/useLogout";
import { useRemoveSharedTree } from "../../hooks/useRemoveSharedTree";
import { useTreeAccess } from "../../hooks/useTreeAccess";
import { RemoveSharedTreeDialog } from "../RemoveSharedTreeDialog";
import type { ViewTab } from "./SettingsPanel";
import { SettingsPanel } from "./SettingsPanel";
import type { ActiveView } from "./ViewTabs";
import { ViewTabs } from "./ViewTabs";

/** Beside the view-only label: take this shared tree off your list, then go back to it. */
function RemoveSharedTreeAction({ treeId, ownerLabel }: { treeId: string; ownerLabel: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const { remove, reset, busy, error } = useRemoveSharedTree();

  async function confirm() {
    if (await remove(treeId)) navigate("/trees");
  }

  return (
    <>
      <button
        type="button"
        className="tree-toolbar__remove-shared"
        onClick={() => setConfirming(true)}
      >
        {t("share.removeFromList")}
      </button>
      {confirming && (
        <RemoveSharedTreeDialog
          ownerLabel={ownerLabel}
          busy={busy}
          error={error}
          onConfirm={() => void confirm()}
          onCancel={() => {
            reset();
            setConfirming(false);
          }}
        />
      )}
    </>
  );
}

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
  const { readOnly, ownerLabel } = useTreeAccess(treeId);

  return (
    <div className="tree-toolbar">
      <span className="tree-toolbar__title">{treeName ?? t("tree.untitled")}</span>
      {readOnly && (
        <span className="tree-toolbar__view-only">
          <Eye size={13} aria-hidden="true" />
          {ownerLabel ? t("share.viewOnly", { owner: ownerLabel }) : t("treeList.viewOnly")}
        </span>
      )}
      {readOnly && ownerLabel && <RemoveSharedTreeAction treeId={treeId} ownerLabel={ownerLabel} />}
      <ViewTabs treeId={treeId} activeView={activeView} readOnly={readOnly} />

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
