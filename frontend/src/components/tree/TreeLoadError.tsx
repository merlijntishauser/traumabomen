import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { NO_LONGER_SHARED_KEY, treeLoadErrorKey } from "../../lib/userFacingErrors";

interface TreeLoadErrorProps {
  error: unknown;
  /** The tree was shared with the user: a 404 then means the share was removed. */
  readOnly: boolean;
}

/** Why a tree view could not load, with the way back when a share was removed. */
export function TreeLoadError({ error, readOnly }: TreeLoadErrorProps) {
  const { t } = useTranslation();
  const key = treeLoadErrorKey(error, { readOnly });
  return (
    <div className="tree-load-error">
      <p>{t(key)}</p>
      {key === NO_LONGER_SHARED_KEY && <Link to="/trees">{t("share.backToTrees")}</Link>}
    </div>
  );
}
