import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { uuidToCompact } from "../../lib/compactId";

export type ActiveView = "canvas" | "timeline" | "patterns";

interface ViewTabsProps {
  treeId: string;
  activeView: ActiveView;
}

export function ViewTabs({ treeId, activeView }: ViewTabsProps) {
  const { t } = useTranslation();
  const compactId = uuidToCompact(treeId);

  const tabs: { view: ActiveView; label: string; to: string }[] = [
    { view: "canvas", label: t("tree.canvas"), to: `/trees/${compactId}` },
    { view: "timeline", label: t("tree.timeline"), to: `/trees/${compactId}/timeline` },
    { view: "patterns", label: t("pattern.patterns"), to: `/trees/${compactId}/patterns` },
  ];

  return (
    <nav className="tree-toolbar__tabs">
      {tabs.map((tab) =>
        tab.view === activeView ? (
          <span key={tab.view} className="tree-toolbar__tab tree-toolbar__tab--active">
            {tab.label}
          </span>
        ) : (
          <Link key={tab.view} to={tab.to} className="tree-toolbar__tab">
            {tab.label}
          </Link>
        ),
      )}
    </nav>
  );
}
