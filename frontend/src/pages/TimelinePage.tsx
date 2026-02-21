import { Calendar, Clock, Eye, EyeOff, Filter, Pencil, Search, Waypoints } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CreatePatternMiniForm } from "../components/timeline/CreatePatternMiniForm";
import { MarkerDetailCard } from "../components/timeline/MarkerDetailCard";
import type { MarkerClickInfo, TimelineMode } from "../components/timeline/PersonLane";
import { PersonSummaryCard } from "../components/timeline/PersonSummaryCard";
import { TimelineChipBar } from "../components/timeline/TimelineChipBar";
import { TimelineFilterPanel } from "../components/timeline/TimelineFilterPanel";
import { type LayoutMode, TimelineView } from "../components/timeline/TimelineView";
import {
  computeGenerations,
  computeTimeDomain,
  filterTimelinePersons,
} from "../components/timeline/timelineHelpers";
import { PatternPanel } from "../components/tree/PatternPanel";
import { PersonDetailPanel, type PersonDetailSection } from "../components/tree/PersonDetailPanel";
import { TimelineSettingsContent } from "../components/tree/TimelineSettingsContent";
import { TreeToolbar } from "../components/tree/TreeToolbar";
import { useTimelineFilters } from "../hooks/useTimelineFilters";
import { useTimelineSettings } from "../hooks/useTimelineSettings";
import { useTreeData } from "../hooks/useTreeData";
import { useTreeId } from "../hooks/useTreeId";
import { useTreeMutations } from "../hooks/useTreeMutations";
import { inferSiblings } from "../lib/inferSiblings";
import { computeSmartFilterGroups } from "../lib/smartFilterGroups";
import type {
  Classification,
  LifeEvent,
  LinkedEntity,
  Pattern,
  Person,
  RelationshipData,
  TraumaEvent,
  TurningPoint,
} from "../types/domain";
import "../components/tree/TreeCanvas.css";

function derivePersonIdsFromEntities(
  linkedEntities: LinkedEntity[],
  events: Map<string, { person_ids: string[] }>,
  lifeEvents: Map<string, { person_ids: string[] }>,
  classifications: Map<string, { person_ids: string[] }>,
): string[] {
  const ids = new Set<string>();
  for (const le of linkedEntities) {
    let personIds: string[] = [];
    if (le.entity_type === "trauma_event") {
      personIds = events.get(le.entity_id)?.person_ids ?? [];
    } else if (le.entity_type === "life_event") {
      personIds = lifeEvents.get(le.entity_id)?.person_ids ?? [];
    } else if (le.entity_type === "classification") {
      personIds = classifications.get(le.entity_id)?.person_ids ?? [];
    }
    for (const pid of personIds) ids.add(pid);
  }
  return Array.from(ids);
}

export default function TimelinePage() {
  const treeId = useTreeId();
  const { t } = useTranslation();
  const { settings: timelineSettings, update: updateTimelineSettings } = useTimelineSettings();

  const timelineViewTab = useMemo(
    () => ({
      label: t("settings.timeline"),
      content: (
        <TimelineSettingsContent settings={timelineSettings} onUpdate={updateTimelineSettings} />
      ),
    }),
    [t, timelineSettings, updateTimelineSettings],
  );

  const {
    treeName,
    persons,
    relationships,
    events,
    lifeEvents,
    turningPoints,
    classifications,
    patterns,
    isLoading,
    error,
  } = useTreeData(treeId!);
  const mutations = useTreeMutations(treeId!);

  const [layoutMode, setLayoutMode] = useState<LayoutMode>("years");
  const [scrollMode, setScrollMode] = useState(false);
  const [mode, setMode] = useState<TimelineMode>("explore");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [focusedMarker, setFocusedMarker] = useState<MarkerClickInfo | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [initialSection, setInitialSection] = useState<PersonDetailSection>(null);

  // Pattern state
  const [selectedEntityKeys, setSelectedEntityKeys] = useState<Set<string>>(new Set());
  const [patternPanelOpen, setPatternPanelOpen] = useState(false);
  const [showPatterns, setShowPatterns] = useState(true);
  const [hoveredPatternId, setHoveredPatternId] = useState<string | null>(null);
  const [focusedPatternId, setFocusedPatternId] = useState<string | null>(null);

  const {
    filters,
    actions: filterActions,
    dims,
  } = useTimelineFilters(persons, events, lifeEvents, classifications, patterns);

  // Compute time domain for filter panel
  const timelinePersons = useMemo(
    () => filterTimelinePersons(persons, relationships),
    [persons, relationships],
  );
  const timeDomain = useMemo(
    () => computeTimeDomain(timelinePersons, events, lifeEvents, turningPoints),
    [timelinePersons, events, lifeEvents, turningPoints],
  );

  const generations = useMemo(
    () => computeGenerations(timelinePersons, relationships),
    [timelinePersons, relationships],
  );

  const smartGroups = useMemo(
    () => computeSmartFilterGroups(timelinePersons, relationships, generations),
    [timelinePersons, relationships, generations],
  );

  const usedTraumaCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const e of events.values()) cats.add(e.category);
    return cats;
  }, [events]);

  const usedLifeEventCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const le of lifeEvents.values()) cats.add(le.category);
    return cats;
  }, [lifeEvents]);

  const usedClassifications = useMemo(() => {
    const cats = new Map<string, Set<string>>();
    for (const c of classifications.values()) {
      if (!cats.has(c.dsm_category)) cats.set(c.dsm_category, new Set());
      if (c.dsm_subcategory) cats.get(c.dsm_category)!.add(c.dsm_subcategory);
    }
    return cats;
  }, [classifications]);

  // Visible pattern IDs (show all when showPatterns is on, unless filter overrides)
  const visiblePatternIds = useMemo(() => {
    if (!showPatterns) return new Set<string>();
    // If pattern filter is active, only show filtered patterns
    if (filters.visiblePatterns !== null) return filters.visiblePatterns;
    return new Set(patterns.keys());
  }, [showPatterns, patterns, filters.visiblePatterns]);

  // Include hovered pattern even if not in visible set
  const effectiveVisiblePatternIds = useMemo(() => {
    if (!hoveredPatternId || visiblePatternIds.has(hoveredPatternId)) return visiblePatternIds;
    return new Set([...visiblePatternIds, hoveredPatternId]);
  }, [visiblePatternIds, hoveredPatternId]);

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

  const selectedTurningPoints = useMemo(
    () =>
      selectedPersonId
        ? Array.from(turningPoints.values()).filter((tp) =>
            tp.person_ids.includes(selectedPersonId),
          )
        : [],
    [selectedPersonId, turningPoints],
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

  // Clear entity selection when leaving annotate mode
  useEffect(() => {
    if (mode !== "annotate") {
      setSelectedEntityKeys(new Set());
    }
  }, [mode]);

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Priority: clear entity selection -> close panels -> exit mode
        if (selectedEntityKeys.size > 0) {
          setSelectedEntityKeys(new Set());
          return;
        }
        if (patternPanelOpen) {
          setPatternPanelOpen(false);
          setFocusedPatternId(null);
          return;
        }
        if (selectedPersonId) {
          setSelectedPersonId(null);
          return;
        }
        if (filterPanelOpen) {
          setFilterPanelOpen(false);
          return;
        }
        if (mode === "edit" || mode === "annotate") {
          setMode("explore");
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedEntityKeys, patternPanelOpen, selectedPersonId, filterPanelOpen, mode]);

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

  function handleSaveTurningPoint(
    turningPointId: string | null,
    data: TurningPoint,
    personIds: string[],
  ) {
    if (turningPointId) {
      mutations.updateTurningPoint.mutate({ turningPointId, personIds, data });
    } else {
      mutations.createTurningPoint.mutate({ personIds, data });
    }
  }

  function handleDeleteTurningPoint(turningPointId: string) {
    mutations.deleteTurningPoint.mutate(turningPointId);
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

  // Pattern mutation handlers
  function handleSavePattern(patternId: string | null, data: Pattern, personIds: string[]) {
    if (patternId) {
      mutations.updatePattern.mutate({ patternId, personIds, data });
    } else {
      mutations.createPattern.mutate({ personIds, data });
    }
  }

  function handleDeletePattern(patternId: string) {
    mutations.deletePattern.mutate(patternId);
  }

  function handleTogglePatternVisibility(patternId: string) {
    // This toggles individual pattern visibility in the filter
    filterActions.togglePatternFilter(patternId);
  }

  const handleToggleScrollMode = useCallback(() => {
    setScrollMode((v) => !v);
  }, []);

  // Annotate mode handlers
  const handleToggleEntitySelect = useCallback((key: string) => {
    setSelectedEntityKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleCreatePattern = useCallback(
    (name: string, description: string, color: string) => {
      const linked_entities: LinkedEntity[] = Array.from(selectedEntityKeys).map((key) => {
        const [entity_type, entity_id] = key.split(":");
        return { entity_type: entity_type as LinkedEntity["entity_type"], entity_id };
      });
      const personIds = derivePersonIdsFromEntities(
        linked_entities,
        events,
        lifeEvents,
        classifications,
      );
      mutations.createPattern.mutate({
        personIds,
        data: { name, description, color, linked_entities },
      });
      setSelectedEntityKeys(new Set());
    },
    [selectedEntityKeys, events, lifeEvents, classifications, mutations],
  );

  const handleClickPartnerLine = useCallback(
    (relationshipId: string) => {
      if (mode !== "edit") return;
      const rel = relationships.get(relationshipId);
      if (!rel) return;
      setSelectedPersonId(rel.source_person_id);
      setInitialSection("relationships");
      setFilterPanelOpen(false);
    },
    [mode, relationships],
  );

  const handlePatternClick = useCallback((patternId: string) => {
    setFocusedPatternId(patternId);
    setPatternPanelOpen(true);
  }, []);

  // Timeline interaction handlers
  const handleSelectPerson = useCallback(
    (personId: string | null) => {
      setSelectedPersonId(personId);
      setFocusedMarker(null);
      if (personId && mode === "edit") {
        setInitialSection("person");
        setFilterPanelOpen(false);
      }
    },
    [mode],
  );

  const handleClickMarker = useCallback(
    (info: MarkerClickInfo) => {
      if (mode === "explore") {
        setFocusedMarker((prev) => (prev?.entityId === info.entityId ? null : info));
      } else if (mode === "edit") {
        setSelectedPersonId(info.personId);
        setInitialSection(info.entityType);
        setFilterPanelOpen(false);
      }
    },
    [mode],
  );

  const tabClass = (active: boolean) =>
    `tree-toolbar__tab${active ? " tree-toolbar__tab--active" : ""}`;

  if (error) {
    return (
      <div className="tree-workspace">
        <TreeToolbar
          treeId={treeId!}
          treeName={treeName}
          activeView="timeline"
          viewTab={timelineViewTab}
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
        viewTab={timelineViewTab}
      >
        {/* Layout mode segment control */}
        <div className="tree-toolbar__tabs">
          <button
            type="button"
            className={tabClass(layoutMode === "years")}
            onClick={() => setLayoutMode("years")}
          >
            <Calendar size={14} />
            {t("timeline.years")}
          </button>
          <button
            type="button"
            className={tabClass(layoutMode === "age")}
            onClick={() => setLayoutMode("age")}
          >
            <Clock size={14} />
            {t("timeline.age")}
          </button>
        </div>

        {/* Interaction mode segment control */}
        <div className="tree-toolbar__tabs">
          <button
            type="button"
            className={tabClass(mode === "explore")}
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
            className={tabClass(mode === "edit")}
            onClick={() => {
              setMode("edit");
              setSelectedPersonId(null);
            }}
          >
            <Pencil size={14} />
            {t("timeline.edit")}
          </button>
          <button
            type="button"
            className={tabClass(mode === "annotate")}
            onClick={() => {
              setMode("annotate");
              setSelectedPersonId(null);
            }}
          >
            <Waypoints size={14} />
            {t("timeline.annotate")}
          </button>
        </div>

        <div className="tree-toolbar__separator" />

        <button
          type="button"
          className={`tree-toolbar__icon-btn${showPatterns ? " tree-toolbar__icon-btn--active" : ""}`}
          onClick={() => setShowPatterns((v) => !v)}
          aria-label={showPatterns ? t("timeline.hidePatterns") : t("timeline.showPatterns")}
        >
          {showPatterns ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          type="button"
          className={`tree-toolbar__icon-btn${filterPanelOpen ? " tree-toolbar__icon-btn--active" : ""}`}
          onClick={() => setFilterPanelOpen((v) => !v)}
          aria-label={t("timeline.filter")}
        >
          <Filter size={14} />
          {filterActions.activeFilterCount > 0 && (
            <span className="tl-filter-badge">{filterActions.activeFilterCount}</span>
          )}
        </button>
      </TreeToolbar>

      {filterActions.activeFilterCount > 0 && (
        <TimelineChipBar
          filters={filters}
          actions={filterActions}
          persons={persons}
          patterns={patterns}
        />
      )}

      {mode === "annotate" && selectedEntityKeys.size === 0 && (
        <output className="tl-annotate-hint">{t("timeline.annotateHint")}</output>
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
            turningPoints={turningPoints}
            classifications={classifications}
            mode={mode}
            selectedPersonId={selectedPersonId}
            dims={dims}
            filterMode={filters.filterMode}
            layoutMode={layoutMode}
            onSelectPerson={handleSelectPerson}
            onClickMarker={handleClickMarker}
            onClickPartnerLine={handleClickPartnerLine}
            patterns={patterns}
            visiblePatternIds={effectiveVisiblePatternIds}
            selectedEntityKeys={selectedEntityKeys}
            hoveredPatternId={hoveredPatternId}
            onToggleEntitySelect={handleToggleEntitySelect}
            onPatternHover={setHoveredPatternId}
            onPatternClick={handlePatternClick}
            showPartnerLines={timelineSettings.showPartnerLines}
            showPartnerLabels={timelineSettings.showPartnerLabels}
            showClassifications={timelineSettings.showClassifications}
            showGridlines={timelineSettings.showGridlines}
            showMarkerLabels={timelineSettings.showMarkerLabels}
            scrollMode={scrollMode}
            onToggleScrollMode={handleToggleScrollMode}
          />
        )}

        {mode === "explore" && focusedMarker && (
          <MarkerDetailCard
            info={focusedMarker}
            persons={persons}
            events={events}
            lifeEvents={lifeEvents}
            turningPoints={turningPoints}
            classifications={classifications}
            onClose={() => setFocusedMarker(null)}
          />
        )}

        {mode === "explore" && !focusedMarker && selectedPerson && (
          <PersonSummaryCard
            person={selectedPerson}
            events={selectedEvents}
            lifeEvents={selectedLifeEvents}
            classifications={selectedClassifications}
            onClose={() => setSelectedPersonId(null)}
          />
        )}

        {mode === "annotate" && selectedEntityKeys.size > 0 && (
          <CreatePatternMiniForm
            selectedCount={selectedEntityKeys.size}
            onSubmit={handleCreatePattern}
            onCancel={() => setSelectedEntityKeys(new Set())}
          />
        )}

        {filterPanelOpen && (
          <TimelineFilterPanel
            persons={persons}
            filters={filters}
            actions={filterActions}
            timeDomain={timeDomain}
            patterns={patterns}
            groups={smartGroups}
            usedTraumaCategories={usedTraumaCategories}
            usedLifeEventCategories={usedLifeEventCategories}
            usedClassifications={usedClassifications}
            onClose={() => setFilterPanelOpen(false)}
          />
        )}

        {patternPanelOpen && (
          <PatternPanel
            patterns={patterns}
            events={events}
            lifeEvents={lifeEvents}
            classifications={classifications}
            persons={persons}
            visiblePatternIds={effectiveVisiblePatternIds}
            onToggleVisibility={handleTogglePatternVisibility}
            onSave={handleSavePattern}
            onDelete={handleDeletePattern}
            onClose={() => {
              setPatternPanelOpen(false);
              setFocusedPatternId(null);
            }}
            onHoverPattern={setHoveredPatternId}
            initialExpandedId={focusedPatternId}
          />
        )}

        {mode === "edit" && selectedPerson && (
          <PersonDetailPanel
            person={selectedPerson}
            relationships={selectedRelationships}
            inferredSiblings={selectedInferredSiblings}
            events={selectedEvents}
            lifeEvents={selectedLifeEvents}
            turningPoints={selectedTurningPoints}
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
            onSaveTurningPoint={handleSaveTurningPoint}
            onDeleteTurningPoint={handleDeleteTurningPoint}
            onSaveClassification={handleSaveClassification}
            onDeleteClassification={handleDeleteClassification}
            onClose={() => setSelectedPersonId(null)}
          />
        )}
      </div>
    </div>
  );
}
