import type { useLinkedEntityPanelHandlers } from "../hooks/useLinkedEntityPanelHandlers";
import type { SelectedPersonEntities } from "../hooks/useSelectedPersonEntities";
import type { useTreeData } from "../hooks/useTreeData";
import type { WorkspacePanelState } from "../hooks/useWorkspacePanels";
import { JournalPanel } from "./journal/JournalPanel";
import { PatternPanel } from "./tree/PatternPanel";
import { PersonDetailPanel } from "./tree/PersonDetailPanel";

export interface WorkspacePanelHostProps {
  panels: WorkspacePanelState;
  handlers: ReturnType<typeof useLinkedEntityPanelHandlers>;
  entities: SelectedPersonEntities;
  treeData: ReturnType<typeof useTreeData>;
  visiblePatternIds: Set<string>;
  onTogglePatternVisibility: (id: string) => void;
  initialExpandedPatternId?: string | null;
  initialEntityId?: string;
  showReflectionPrompts: boolean;
  showPersonPanel?: boolean;
  onClosePatternPanel?: () => void;
}

export function WorkspacePanelHost({
  panels,
  handlers,
  entities,
  treeData,
  visiblePatternIds,
  onTogglePatternVisibility,
  initialExpandedPatternId,
  initialEntityId,
  showReflectionPrompts,
  showPersonPanel = true,
  onClosePatternPanel,
}: WorkspacePanelHostProps) {
  const { persons, events, lifeEvents, turningPoints, classifications, patterns, journalEntries } =
    treeData;

  const selectedPerson = panels.selectedPersonId
    ? (persons.get(panels.selectedPersonId) ?? null)
    : null;

  return (
    <>
      {showPersonPanel && selectedPerson && (
        <PersonDetailPanel
          person={selectedPerson}
          relationships={entities.selectedRelationships}
          inferredSiblings={entities.selectedInferredSiblings}
          events={entities.selectedEvents}
          lifeEvents={entities.selectedLifeEvents}
          turningPoints={entities.selectedTurningPoints}
          classifications={entities.selectedClassifications}
          allPersons={persons}
          initialSection={panels.initialSection}
          initialEntityId={initialEntityId}
          handlers={{
            onSavePerson: handlers.handleSavePerson,
            onDeletePerson: handlers.handleDeletePerson,
            onSaveRelationship: handlers.handleSaveRelationship,
            onClose: () => panels.setSelectedPersonId(null),
          }}
          entityHandlers={{
            onSaveEvent: handlers.eventHandlers.save,
            onDeleteEvent: handlers.eventHandlers.remove,
            onSaveLifeEvent: handlers.lifeEventHandlers.save,
            onDeleteLifeEvent: handlers.lifeEventHandlers.remove,
            onSaveTurningPoint: handlers.turningPointHandlers.save,
            onDeleteTurningPoint: handlers.turningPointHandlers.remove,
            onSaveClassification: handlers.classificationHandlers.save,
            onDeleteClassification: handlers.classificationHandlers.remove,
          }}
          showReflectionPrompts={showReflectionPrompts}
          onOpenJournal={panels.openJournal}
        />
      )}

      {panels.patternPanelOpen && (
        <PatternPanel
          patterns={patterns}
          events={events}
          lifeEvents={lifeEvents}
          turningPoints={turningPoints}
          classifications={classifications}
          persons={persons}
          visiblePatternIds={visiblePatternIds}
          onToggleVisibility={onTogglePatternVisibility}
          onSave={handlers.patternHandlers.save}
          onDelete={handlers.patternHandlers.remove}
          onClose={onClosePatternPanel ?? (() => panels.setPatternPanelOpen(false))}
          onHoverPattern={panels.setHoveredPatternId}
          initialExpandedId={initialExpandedPatternId}
        />
      )}

      {panels.journalPanelOpen && (
        <JournalPanel
          journalEntries={journalEntries}
          persons={persons}
          events={events}
          lifeEvents={lifeEvents}
          turningPoints={turningPoints}
          classifications={classifications}
          patterns={patterns}
          onSave={handlers.handleSaveJournalEntry}
          onDelete={handlers.handleDeleteJournalEntry}
          onClose={() => panels.setJournalPanelOpen(false)}
          initialPrompt={panels.journalInitialPrompt}
          initialLinkedRef={panels.journalInitialLinkedRef}
        />
      )}
    </>
  );
}
