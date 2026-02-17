import { useTranslation } from "react-i18next";
import { TimelineView } from "../components/timeline/TimelineView";
import { TreeToolbar } from "../components/tree/TreeToolbar";
import { useCanvasSettings } from "../hooks/useCanvasSettings";
import { useTreeData } from "../hooks/useTreeData";
import { useTreeId } from "../hooks/useTreeId";
import "../components/tree/TreeCanvas.css";

export default function TimelinePage() {
  const treeId = useTreeId();
  const { t } = useTranslation();
  const { settings: canvasSettings, update: updateCanvasSettings } = useCanvasSettings();
  const {
    treeName,
    persons,
    relationships,
    events,
    lifeEvents,
    classifications,
    isLoading,
    error,
  } = useTreeData(treeId!);

  if (error) {
    return (
      <div className="tree-workspace">
        <TreeToolbar
          treeId={treeId!}
          treeName={treeName}
          activeView="timeline"
          canvasSettings={canvasSettings}
          onUpdateSettings={updateCanvasSettings}
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
        activeView="timeline"
        canvasSettings={canvasSettings}
        onUpdateSettings={updateCanvasSettings}
      />

      {isLoading ? (
        <div style={{ padding: 20 }}>{t("common.loading")}</div>
      ) : (
        <TimelineView
          persons={persons}
          relationships={relationships}
          events={events}
          lifeEvents={lifeEvents}
          classifications={classifications}
        />
      )}
    </div>
  );
}
