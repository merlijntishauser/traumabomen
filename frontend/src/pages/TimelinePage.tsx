import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { TimelineView } from "../components/timeline/TimelineView";
import { SettingsPanel } from "../components/tree/SettingsPanel";
import { useCanvasSettings } from "../hooks/useCanvasSettings";
import { useLogout } from "../hooks/useLogout";
import { useTreeData } from "../hooks/useTreeData";
import { useTreeId } from "../hooks/useTreeId";
import { uuidToCompact } from "../lib/compactId";
import "../components/tree/TreeCanvas.css";

export default function TimelinePage() {
  const treeId = useTreeId();
  const { t } = useTranslation();
  const logout = useLogout();
  const { settings: canvasSettings, update: updateCanvasSettings } = useCanvasSettings();
  const { treeName, persons, relationships, events, lifeEvents, isLoading, error } = useTreeData(
    treeId!,
  );

  if (error) {
    return (
      <div className="tree-workspace">
        <div className="tree-toolbar">
          <span className="tree-toolbar__title">{treeName ?? t("tree.untitled")}</span>
          <div className="tree-toolbar__spacer" />
          <Link to="/trees" className="tree-toolbar__btn">
            {t("nav.trees")}
          </Link>
        </div>
        <div style={{ padding: 20 }}>{t("tree.decryptionError")}</div>
      </div>
    );
  }

  return (
    <div className="tree-workspace">
      <div className="tree-toolbar">
        <span className="tree-toolbar__title">{treeName ?? t("tree.untitled")}</span>
        <div className="tree-toolbar__spacer" />
        <div className="tree-toolbar__group">
          <Link
            to={`/trees/${uuidToCompact(treeId!)}`}
            className="tree-toolbar__icon-btn"
            aria-label={t("tree.canvas")}
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
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </Link>
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
        </div>

        <div className="tree-toolbar__separator" />

        <div className="tree-toolbar__group">
          <SettingsPanel
            settings={canvasSettings}
            onUpdate={updateCanvasSettings}
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

      {isLoading ? (
        <div style={{ padding: 20 }}>{t("common.loading")}</div>
      ) : (
        <TimelineView
          persons={persons}
          relationships={relationships}
          events={events}
          lifeEvents={lifeEvents}
        />
      )}
    </div>
  );
}
