import { Filter, Pencil, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MarkerClickInfo, TimelineMode } from "../components/timeline/PersonLane";
import { TimelineChipBar } from "../components/timeline/TimelineChipBar";
import { TimelineFilterPanel } from "../components/timeline/TimelineFilterPanel";
import { TimelineView } from "../components/timeline/TimelineView";
import { computeTimeDomain, filterTimelinePersons } from "../components/timeline/timelineHelpers";
import { PersonDetailPanel, type PersonDetailSection } from "../components/tree/PersonDetailPanel";
import { TreeToolbar } from "../components/tree/TreeToolbar";
import { useCanvasSettings } from "../hooks/useCanvasSettings";
import { useTimelineFilters } from "../hooks/useTimelineFilters";
import { useTreeData } from "../hooks/useTreeData";
import { useTreeId } from "../hooks/useTreeId";
import { useTreeMutations } from "../hooks/useTreeMutations";
import { inferSiblings } from "../lib/inferSiblings";
import type {
  Classification,
  LifeEvent,
  Person,
  RelationshipData,
  TraumaEvent,
} from "../types/domain";
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
  const mutations = useTreeMutations(treeId!);

  const [mode, setMode] = useState<TimelineMode>("explore");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [initialSection, setInitialSection] = useState<PersonDetailSection>(null);

  const {
    filters,
    actions: filterActions,
    dims,
  } = useTimelineFilters(persons, events, lifeEvents, classifications);

  // Compute time domain for filter panel
  const timelinePersons = useMemo(
    () => filterTimelinePersons(persons, relationships),
    [persons, relationships],
  );
  const timeDomain = useMemo(
    () => computeTimeDomain(timelinePersons, events, lifeEvents),
    [timelinePersons, events, lifeEvents],
  );

  // Derived state for PersonDetailPanel
  const selectedPerson = selectedPersonId ? (persons.get(selectedPersonId) ?? null) : null;

  const selectedRelationships = useMemo(
    () =>
      selectedPersonId
        ? Array.from(relationships.values()).filter(
            (r) =>
              r.source_person_id === selectedPersonId || r.target_person_id === selectedPersonId,
          )
        : [],
    [selectedPersonId, relationships],
  );

  const selectedEvents = useMemo(
    () =>
      selectedPersonId
        ? Array.from(events.values()).filter((e) => e.person_ids.includes(selectedPersonId))
        : [],
    [selectedPersonId, events],
  );

  const selectedLifeEvents = useMemo(
    () =>
      selectedPersonId
        ? Array.from(lifeEvents.values()).filter((e) => e.person_ids.includes(selectedPersonId))
        : [],
    [selectedPersonId, lifeEvents],
  );

  const selectedClassifications = useMemo(
    () =>
      selectedPersonId
        ? Array.from(classifications.values()).filter((c) =>
            c.person_ids.includes(selectedPersonId),
          )
        : [],
    [selectedPersonId, classifications],
  );

  const inferredSiblings = useMemo(() => inferSiblings(relationships), [relationships]);

  const selectedInferredSiblings = useMemo(
    () =>
      selectedPersonId
        ? inferredSiblings.filter(
            (s) => s.personAId === selectedPersonId || s.personBId === selectedPersonId,
          )
        : [],
    [selectedPersonId, inferredSiblings],
  );

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selectedPersonId) {
          setSelectedPersonId(null);
          return;
        }
        if (filterPanelOpen) {
          setFilterPanelOpen(false);
          return;
        }
        if (mode === "edit") {
          setMode("explore");
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedPersonId, filterPanelOpen, mode]);

  // Mutation handlers (same pattern as TreeWorkspacePage)
  function handleSavePerson(data: Person) {
    if (!selectedPersonId) return;
    mutations.updatePerson.mutate({ personId: selectedPersonId, data });
  }

  function handleDeletePerson(personId: string) {
    mutations.deletePerson.mutate(personId, {
      onSuccess: () => setSelectedPersonId(null),
    });
  }

  function handleSaveRelationship(relationshipId: string, data: RelationshipData) {
    mutations.updateRelationship.mutate({ relationshipId, data });
  }

  function handleSaveEvent(eventId: string | null, data: TraumaEvent, personIds: string[]) {
    if (eventId) {
      mutations.updateEvent.mutate({ eventId, personIds, data });
    } else {
      mutations.createEvent.mutate({ personIds, data });
    }
  }

  function handleDeleteEvent(eventId: string) {
    mutations.deleteEvent.mutate(eventId);
  }

  function handleSaveLifeEvent(lifeEventId: string | null, data: LifeEvent, personIds: string[]) {
    if (lifeEventId) {
      mutations.updateLifeEvent.mutate({ lifeEventId, personIds, data });
    } else {
      mutations.createLifeEvent.mutate({ personIds, data });
    }
  }

  function handleDeleteLifeEvent(lifeEventId: string) {
    mutations.deleteLifeEvent.mutate(lifeEventId);
  }

  function handleSaveClassification(
    classificationId: string | null,
    data: Classification,
    personIds: string[],
  ) {
    if (classificationId) {
      mutations.updateClassification.mutate({ classificationId, personIds, data });
    } else {
      mutations.createClassification.mutate({ personIds, data });
    }
  }

  function handleDeleteClassification(classificationId: string) {
    mutations.deleteClassification.mutate(classificationId);
  }

  // Timeline interaction handlers
  const handleSelectPerson = useCallback(
    (personId: string | null) => {
      setSelectedPersonId(personId);
      if (personId && mode === "edit") {
        setInitialSection("person");
        setFilterPanelOpen(false);
      }
    },
    [mode],
  );

  const handleClickMarker = useCallback(
    (info: MarkerClickInfo) => {
      if (mode === "edit") {
        setSelectedPersonId(info.personId);
        setInitialSection(info.entityType);
        setFilterPanelOpen(false);
      }
    },
    [mode],
  );

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
      >
        <button
          type="button"
          className={`tree-toolbar__btn${mode === "explore" ? " tree-toolbar__btn--active" : ""}`}
          onClick={() => {
            setMode("explore");
            setSelectedPersonId(null);
          }}
        >
          <Search size={14} />
          {t("timeline.explore")}
        </button>
        <button
          type="button"
          className={`tree-toolbar__btn${mode === "edit" ? " tree-toolbar__btn--active" : ""}`}
          onClick={() => {
            setMode("edit");
            setSelectedPersonId(null);
          }}
        >
          <Pencil size={14} />
          {t("timeline.edit")}
        </button>
        <div className="tree-toolbar__separator" />
        <button
          type="button"
          className="tree-toolbar__icon-btn"
          onClick={() => setFilterPanelOpen((v) => !v)}
          aria-label={t("timeline.filter")}
          style={{ position: "relative" }}
        >
          <Filter size={16} />
          {filterActions.activeFilterCount > 0 && (
            <span className="tl-filter-badge">{filterActions.activeFilterCount}</span>
          )}
        </button>
      </TreeToolbar>

      {filterActions.activeFilterCount > 0 && (
        <TimelineChipBar filters={filters} actions={filterActions} persons={persons} />
      )}

      <div className="timeline-workspace-area">
        {isLoading ? (
          <div style={{ padding: 20 }}>{t("common.loading")}</div>
        ) : (
          <TimelineView
            persons={persons}
            relationships={relationships}
            events={events}
            lifeEvents={lifeEvents}
            classifications={classifications}
            mode={mode}
            selectedPersonId={selectedPersonId}
            dims={dims}
            onSelectPerson={handleSelectPerson}
            onClickMarker={handleClickMarker}
          />
        )}

        {filterPanelOpen && (
          <TimelineFilterPanel
            persons={persons}
            filters={filters}
            actions={filterActions}
            timeDomain={timeDomain}
            onClose={() => setFilterPanelOpen(false)}
          />
        )}

        {mode === "edit" && selectedPerson && (
          <PersonDetailPanel
            person={selectedPerson}
            relationships={selectedRelationships}
            inferredSiblings={selectedInferredSiblings}
            events={selectedEvents}
            lifeEvents={selectedLifeEvents}
            classifications={selectedClassifications}
            allPersons={persons}
            initialSection={initialSection}
            onSavePerson={handleSavePerson}
            onDeletePerson={handleDeletePerson}
            onSaveRelationship={handleSaveRelationship}
            onSaveEvent={handleSaveEvent}
            onDeleteEvent={handleDeleteEvent}
            onSaveLifeEvent={handleSaveLifeEvent}
            onDeleteLifeEvent={handleDeleteLifeEvent}
            onSaveClassification={handleSaveClassification}
            onDeleteClassification={handleDeleteClassification}
            onClose={() => setSelectedPersonId(null)}
          />
        )}
      </div>
    </div>
  );
}
