import {
  BookOpen,
  Calendar,
  Clock,
  Eye,
  EyeOff,
  Filter,
  Pencil,
  Search,
  Waypoints,
} from "lucide-react";
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
import { TimelineSettingsContent } from "../components/tree/TimelineSettingsContent";
import { TreeToolbar } from "../components/tree/TreeToolbar";
import { WorkspacePanelHost } from "../components/WorkspacePanelHost";
import { useCanvasSettings } from "../hooks/useCanvasSettings";
import { useLinkedEntityPanelHandlers } from "../hooks/useLinkedEntityPanelHandlers";
import { useSelectedPersonEntities } from "../hooks/useSelectedPersonEntities";
import { useTimelineFilters } from "../hooks/useTimelineFilters";
import { useTimelineSettings } from "../hooks/useTimelineSettings";
import { useTreeData } from "../hooks/useTreeData";
import { useTreeId } from "../hooks/useTreeId";
import { useTreeMutations } from "../hooks/useTreeMutations";
import { useWorkspacePanels } from "../hooks/useWorkspacePanels";
import { derivePersonIds } from "../lib/patternEntities";
import { computeSmartFilterGroups } from "../lib/smartFilterGroups";
import type { LinkedEntity } from "../types/domain";
import "../components/tree/TreeCanvas.css";

const ICON_BTN = "tree-toolbar__icon-btn";
const ICON_BTN_ACTIVE = `${ICON_BTN} ${ICON_BTN}--active`;

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
    isLoading,
    error,
  } = treeData;
  const mutations = useTreeMutations(treeId!);

  const panels = useWorkspacePanels();
  const { selectedPersonId, setSelectedPersonId } = panels;

  const [layoutMode, setLayoutMode] = useState<LayoutMode>("years");
  const [scrollMode, setScrollMode] = useState(false);
  const [mode, setMode] = useState<TimelineMode>("explore");
  const [focusedMarker, setFocusedMarker] = useState<MarkerClickInfo | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // Pattern state
  const [selectedEntityKeys, setSelectedEntityKeys] = useState<Set<string>>(new Set());
  const [showPatterns, setShowPatterns] = useState(true);
  const [focusedPatternId, setFocusedPatternId] = useState<string | null>(null);

  const { settings: canvasSettings } = useCanvasSettings();

  const {
    filters,
    actions: filterActions,
    dims,
  } = useTimelineFilters(persons, events, lifeEvents, turningPoints, classifications, patterns);

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
    if (!panels.hoveredPatternId || visiblePatternIds.has(panels.hoveredPatternId))
      return visiblePatternIds;
    return new Set([...visiblePatternIds, panels.hoveredPatternId]);
  }, [visiblePatternIds, panels.hoveredPatternId]);

  // Derived state for PersonDetailPanel
  const selectedPerson = selectedPersonId ? (persons.get(selectedPersonId) ?? null) : null;

  const selectedEntities = useSelectedPersonEntities(
    selectedPersonId,
    relationships,
    events,
    lifeEvents,
    turningPoints,
    classifications,
  );

  const handlers = useLinkedEntityPanelHandlers({
    mutations,
    selectedPersonId,
    onPersonDeleted: () => setSelectedPersonId(null),
  });

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
        if (panels.journalPanelOpen) {
          panels.setJournalPanelOpen(false);
          return;
        }
        if (panels.patternPanelOpen) {
          panels.setPatternPanelOpen(false);
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
  }, [selectedEntityKeys, panels, selectedPersonId, setSelectedPersonId, filterPanelOpen, mode]);

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
      const personIds = derivePersonIds(linked_entities, {
        events,
        lifeEvents,
        turningPoints,
        classifications,
      });
      mutations.patterns.create.mutate({
        personIds,
        data: { name, description, color, linked_entities },
      });
      setSelectedEntityKeys(new Set());
    },
    [selectedEntityKeys, events, lifeEvents, turningPoints, classifications, mutations],
  );

  const handleClickPartnerLine = useCallback(
    (relationshipId: string) => {
      if (mode !== "edit") return;
      const rel = relationships.get(relationshipId);
      if (!rel) return;
      setSelectedPersonId(rel.source_person_id);
      panels.setInitialSection("relationships");
      setFilterPanelOpen(false);
    },
    [mode, relationships, setSelectedPersonId, panels],
  );

  const handlePatternClick = useCallback(
    (patternId: string) => {
      setFocusedPatternId(patternId);
      panels.setPatternPanelOpen(true);
    },
    [panels],
  );

  // Timeline interaction handlers
  const handleSelectPerson = useCallback(
    (personId: string | null) => {
      setSelectedPersonId(personId);
      setFocusedMarker(null);
      if (personId && mode === "edit") {
        panels.setInitialSection("person");
        setFilterPanelOpen(false);
      }
    },
    [mode, setSelectedPersonId, panels],
  );

  const handleClickMarker = useCallback(
    (info: MarkerClickInfo) => {
      if (mode === "explore") {
        setFocusedMarker((prev) => (prev?.entityId === info.entityId ? null : info));
      } else if (mode === "edit") {
        setSelectedPersonId(info.personId);
        panels.setInitialSection(info.entityType);
        setFilterPanelOpen(false);
      }
    },
    [mode, setSelectedPersonId, panels],
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
          className={showPatterns ? ICON_BTN_ACTIVE : ICON_BTN}
          onClick={() => setShowPatterns((v) => !v)}
          aria-label={showPatterns ? t("timeline.hidePatterns") : t("timeline.showPatterns")}
        >
          {showPatterns ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          type="button"
          className={filterPanelOpen ? ICON_BTN_ACTIVE : ICON_BTN}
          onClick={() => setFilterPanelOpen((v) => !v)}
          aria-label={t("timeline.filter")}
        >
          <Filter size={14} />
          {filterActions.activeFilterCount > 0 && (
            <span className="tl-filter-badge">{filterActions.activeFilterCount}</span>
          )}
        </button>
        <button
          type="button"
          className={panels.journalPanelOpen ? ICON_BTN_ACTIVE : ICON_BTN}
          onClick={() => {
            panels.setJournalPanelOpen((v) => !v);
          }}
          aria-label={t("journal.tab")}
        >
          <BookOpen size={14} />
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
            hoveredPatternId={panels.hoveredPatternId}
            onToggleEntitySelect={handleToggleEntitySelect}
            onPatternHover={panels.setHoveredPatternId}
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
            events={selectedEntities.selectedEvents}
            lifeEvents={selectedEntities.selectedLifeEvents}
            classifications={selectedEntities.selectedClassifications}
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

        <WorkspacePanelHost
          panels={panels}
          handlers={handlers}
          entities={selectedEntities}
          treeData={treeData}
          visiblePatternIds={effectiveVisiblePatternIds}
          onTogglePatternVisibility={handleTogglePatternVisibility}
          initialExpandedPatternId={focusedPatternId}
          showReflectionPrompts={canvasSettings.showReflectionPrompts}
          showPersonPanel={mode === "edit"}
          onClosePatternPanel={() => {
            panels.setPatternPanelOpen(false);
            setFocusedPatternId(null);
          }}
        />
      </div>
    </div>
  );
}
