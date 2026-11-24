import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useTreeAccess } from "../../hooks/useTreeAccess";
import { useTreeId } from "../../hooks/useTreeId";
import "./TreeAccessGate.css";

/**
 * Holds a tree view back until it is known whose tree it is. A tree that is
 * not the user's own may still be shared with them once sharing has loaded;
 * rendering it before then would show an editable, empty canvas.
 */
export function TreeAccessGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const treeId = useTreeId() ?? "";
  const { availability } = useTreeAccess(treeId);

  if (availability === "pending") {
    return (
      <div className="tree-access-gate">
        <p>{t("common.loading")}</p>
      </div>
    );
  }
  if (availability === "unavailable") {
    return (
      <div className="tree-access-gate">
        <p>{t("tree.unavailable")}</p>
        <Link to="/trees">{t("share.backToTrees")}</Link>
      </div>
    );
  }
  return <>{children}</>;
}
