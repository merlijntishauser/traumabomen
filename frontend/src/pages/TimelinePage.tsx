import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLogout } from "../hooks/useLogout";
import { useTreeData } from "../hooks/useTreeData";
import { TimelineView } from "../components/timeline/TimelineView";
import { ThemeToggle } from "../components/ThemeToggle";
import "../components/tree/TreeCanvas.css";

export default function TimelinePage() {
  const { id: treeId } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const logout = useLogout();
  const { persons, relationships, events, lifeEvents, isLoading, error } = useTreeData(
    treeId!,
  );

  if (error) {
    return (
      <div className="tree-workspace">
        <div className="tree-toolbar">
          <Link to={`/trees/${treeId}`} className="tree-toolbar__back">
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
        <Link to={`/trees/${treeId}`} className="tree-toolbar__back">
          {t("nav.trees")}
        </Link>
        <div className="tree-toolbar__spacer" />
        <ThemeToggle className="tree-toolbar__btn" />
        <button
          className="tree-toolbar__btn"
          onClick={() => i18n.changeLanguage(i18n.language === "nl" ? "en" : "nl")}
        >
          {i18n.language === "nl" ? "EN" : "NL"}
        </button>
        <button className="tree-toolbar__btn" onClick={logout}>
          {t("nav.logout")}
        </button>
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
