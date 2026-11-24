import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PatternView } from "../components/PatternView";
import { ThemeLanguageSettings } from "../components/tree/ThemeLanguageSettings";
import { TreeLoadError } from "../components/tree/TreeLoadError";
import { TreeToolbar } from "../components/tree/TreeToolbar";
import { useTreeAccess } from "../hooks/useTreeAccess";
import { useTreeData } from "../hooks/useTreeData";
import { useTreeId } from "../hooks/useTreeId";
import "../components/tree/TreeCanvas.css";

export default function PatternPage() {
  const treeId = useTreeId();
  const { t } = useTranslation();
  const { readOnly } = useTreeAccess(treeId!);
  const {
    treeName,
    patterns,
    events,
    lifeEvents,
    turningPoints,
    classifications,
    persons,
    isLoading,
    error,
  } = useTreeData(treeId!);

  const patternViewTab = useMemo(
    () => ({
      label: t("pattern.patterns"),
      content: <ThemeLanguageSettings />,
    }),
    [t],
  );

  if (error) {
    return (
      <div className="tree-workspace">
        <TreeToolbar
          treeId={treeId!}
          treeName={treeName}
          activeView="patterns"
          viewTab={patternViewTab}
        />
        <TreeLoadError error={error} readOnly={readOnly} />
      </div>
    );
  }

  return (
    <div className="tree-workspace">
      <TreeToolbar
        treeId={treeId!}
        treeName={treeName}
        activeView="patterns"
        viewTab={patternViewTab}
      />

      {isLoading ? (
        <div style={{ padding: 20 }}>{t("common.loading")}</div>
      ) : (
        <PatternView
          treeId={treeId!}
          patterns={patterns}
          events={events}
          lifeEvents={lifeEvents}
          turningPoints={turningPoints}
          classifications={classifications}
          persons={persons}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
