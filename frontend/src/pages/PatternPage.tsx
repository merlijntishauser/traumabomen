import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PatternView } from "../components/PatternView";
import { ThemeLanguageSettings } from "../components/tree/ThemeLanguageSettings";
import { TreeToolbar } from "../components/tree/TreeToolbar";
import { useTreeData } from "../hooks/useTreeData";
import { useTreeId } from "../hooks/useTreeId";
import "../components/tree/TreeCanvas.css";

export default function PatternPage() {
  const treeId = useTreeId();
  const { t } = useTranslation();
  const { treeName, patterns, events, lifeEvents, classifications, persons, isLoading, error } =
    useTreeData(treeId!);

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
        <div style={{ padding: 20 }}>{t("tree.decryptionError")}</div>
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
          classifications={classifications}
          persons={persons}
        />
      )}
    </div>
  );
}
