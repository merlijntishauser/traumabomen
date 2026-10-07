import { BookOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FamilyStripesView } from "../components/familyStripes/FamilyStripesView";
import { ThemeLanguageSettings } from "../components/tree/ThemeLanguageSettings";
import { TreeToolbar } from "../components/tree/TreeToolbar";
import { WorkspacePanelHost } from "../components/WorkspacePanelHost";
import { useCanvasSettings } from "../hooks/useCanvasSettings";
import { useLinkedEntityPanelHandlers } from "../hooks/useLinkedEntityPanelHandlers";
import { useSelectedPersonEntities } from "../hooks/useSelectedPersonEntities";
import { useTreeData } from "../hooks/useTreeData";
import { useTreeId } from "../hooks/useTreeId";
import { useTreeMutations } from "../hooks/useTreeMutations";
import { useWorkspacePanels } from "../hooks/useWorkspacePanels";
import type { StripeEntry } from "../lib/familyStripes";
import { treeLoadErrorKey } from "../lib/userFacingErrors";
import "../components/tree/TreeCanvas.css";

/** Escape closes the topmost panel: journal, then patterns, then the person page. */
function useEscapeClosesPanels(panels: ReturnType<typeof useWorkspacePanels>) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (panels.journalPanelOpen) panels.setJournalPanelOpen(false);
      else if (panels.patternPanelOpen) panels.setPatternPanelOpen(false);
      else if (panels.selectedPersonId) panels.setSelectedPersonId(null);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [panels]);
}

export default function TimelinePage() {
  const treeId = useTreeId();
  const { t } = useTranslation();
  const treeData = useTreeData(treeId!);
  const {
    treeName,
    persons,
    relationships,
    events,
    lifeEvents,
    turningPoints,
    classifications,
    patterns,
  } = treeData;
  const mutations = useTreeMutations(treeId!);
  const panels = useWorkspacePanels();
  const { selectedPersonId, setSelectedPersonId } = panels;
  const [entityId, setEntityId] = useState<string | undefined>(undefined);
  const { settings: canvasSettings } = useCanvasSettings();
  useEscapeClosesPanels(panels);

  const viewTab = useMemo(
    () => ({ label: t("settings.timeline"), content: <ThemeLanguageSettings /> }),
    [t],
  );
  const visiblePatternIds = useMemo(() => new Set(patterns.keys()), [patterns]);

  const selectedEntities = useSelectedPersonEntities(
    selectedPersonId,
    relationships,
    events,
    lifeEvents,
    turningPoints,
    classifications,
  );
  const entityHandlers = useLinkedEntityPanelHandlers({
    mutations,
    selectedPersonId,
    onPersonDeleted: () => setSelectedPersonId(null),
  });

  const openPerson = (personId: string) => {
    panels.setInitialSection("person");
    setEntityId(undefined);
    setSelectedPersonId(personId);
  };
  const openEntry = (entry: Pick<StripeEntry, "id" | "kind">, personId: string) => {
    panels.setInitialSection(entry.kind);
    setEntityId(entry.id);
    setSelectedPersonId(personId);
  };

  const toolbar = (
    <TreeToolbar treeId={treeId!} treeName={treeName} activeView="timeline" viewTab={viewTab}>
      <button
        type="button"
        className={`tree-toolbar__icon-btn${panels.journalPanelOpen ? " tree-toolbar__icon-btn--active" : ""}`}
        onClick={() => panels.setJournalPanelOpen((open) => !open)}
        aria-label={t("journal.tab")}
        aria-pressed={panels.journalPanelOpen}
      >
        <BookOpen size={14} />
      </button>
    </TreeToolbar>
  );

  if (treeData.error) {
    return (
      <div className="tree-workspace">
        {toolbar}
        <div style={{ padding: 20 }}>{t(treeLoadErrorKey(treeData.error))}</div>
      </div>
    );
  }

  return (
    <div className="tree-workspace">
      {toolbar}
      <div className="fs-workspace">
        {treeData.isLoading ? (
          <div style={{ padding: 20 }}>{t("common.loading")}</div>
        ) : (
          <FamilyStripesView
            persons={persons}
            relationships={relationships}
            events={events}
            lifeEvents={lifeEvents}
            classifications={classifications}
            turningPoints={turningPoints}
            onOpenPerson={openPerson}
            onOpenEntry={openEntry}
          />
        )}
        <WorkspacePanelHost
          panels={panels}
          handlers={entityHandlers}
          entities={selectedEntities}
          treeData={treeData}
          visiblePatternIds={visiblePatternIds}
          onTogglePatternVisibility={() => {}}
          initialEntityId={entityId}
          showReflectionPrompts={canvasSettings.showReflectionPrompts}
          showPersonPanel
        />
      </div>
    </div>
  );
}
