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
import {
  type Dispatch,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { CreatePatternMiniForm } from "../components/timeline/CreatePatternMiniForm";
import { MarkerDetailCard } from "../components/timeline/MarkerDetailCard";
import { PersonSummaryCard } from "../components/timeline/PersonSummaryCard";
import { TimelineChipBar } from "../components/timeline/TimelineChipBar";
import { TimelineFilterPanel } from "../components/timeline/TimelineFilterPanel";
import { type LayoutMode, TimelineView } from "../components/timeline/TimelineView";
import type { MarkerClickInfo, TimelineMode } from "../components/timeline/timelineHelpers";
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
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedTurningPoint,
} from "../hooks/useTreeData";
import { useTreeData } from "../hooks/useTreeData";
import { useTreeId } from "../hooks/useTreeId";
import { useTreeMutations } from "../hooks/useTreeMutations";
import { useWorkspacePanels } from "../hooks/useWorkspacePanels";
import { derivePersonIds } from "../lib/patternEntities";
import { computeSmartFilterGroups } from "../lib/smartFilterGroups";
import type { LinkedEntity, Pattern } from "../types/domain";
import "../components/tree/TreeCanvas.css";

const ICON_BTN = "tree-toolbar__icon-btn";
const ICON_BTN_ACTIVE = `${ICON_BTN} ${ICON_BTN}--active`;

const tabClass = (active: boolean) =>
  `tree-toolbar__tab${active ? " tree-toolbar__tab--active" : ""}`;

/* -- Toolbar sub-components ------------------------------------------------ */

interface LayoutModeTabsProps {
  layoutMode: LayoutMode;
  onSetLayoutMode: (mode: LayoutMode) => void;
}

function LayoutModeTabs({ layoutMode, onSetLayoutMode }: LayoutModeTabsProps) {
  const { t } = useTranslation();
  return (
    <div className="tree-toolbar__tabs">
      <button
        type="button"
        className={tabClass(layoutMode === "years")}
        onClick={() => onSetLayoutMode("years")}
        aria-label={t("timeline.years")}
      >
        <Calendar size={14} />
        <span className="tree-toolbar__tab-label">{t("timeline.years")}</span>
      </button>
      <button
        type="button"
        className={tabClass(layoutMode === "age")}
        onClick={() => onSetLayoutMode("age")}
        aria-label={t("timeline.age")}
      >
        <Clock size={14} />
        <span className="tree-toolbar__tab-label">{t("timeline.age")}</span>
      </button>
    </div>
  );
}

interface InteractionModeTabsProps {
  mode: TimelineMode;
  onSetMode: (mode: TimelineMode) => void;
}

function InteractionModeTabs({ mode, onSetMode }: InteractionModeTabsProps) {
  const { t } = useTranslation();
  return (
    <div className="tree-toolbar__tabs">
      <button
        type="button"
        className={tabClass(mode === "explore")}
        onClick={() => onSetMode("explore")}
        aria-label={t("timeline.explore")}
      >
        <Search size={14} />
        <span className="tree-toolbar__tab-label">{t("timeline.explore")}</span>
      </button>
      <button
        type="button"
        className={tabClass(mode === "edit")}
        onClick={() => onSetMode("edit")}
        aria-label={t("timeline.edit")}
      >
        <Pencil size={14} />
        <span className="tree-toolbar__tab-label">{t("timeline.edit")}</span>
      </button>
      <button
        type="button"
        className={tabClass(mode === "annotate")}
        onClick={() => onSetMode("annotate")}
        aria-label={t("timeline.annotate")}
      >
        <Waypoints size={14} />
        <span className="tree-toolbar__tab-label">{t("timeline.annotate")}</span>
      </button>
    </div>
  );
}

interface ToolbarActionButtonsProps {
  showPatterns: boolean;
  onTogglePatterns: () => void;
  filterPanelOpen: boolean;
  onToggleFilterPanel: () => void;
  activeFilterCount: number;
  journalPanelOpen: boolean;
  onToggleJournal: () => void;
}

function ToolbarActionButtons({
  showPatterns,
  onTogglePatterns,
  filterPanelOpen,
  onToggleFilterPanel,
  activeFilterCount,
  journalPanelOpen,
  onToggleJournal,
}: ToolbarActionButtonsProps) {
  const { t } = useTranslation();
  return (
    <>
      <button
        type="button"
        className={showPatterns ? ICON_BTN_ACTIVE : ICON_BTN}
        onClick={onTogglePatterns}
        aria-label={showPatterns ? t("timeline.hidePatterns") : t("timeline.showPatterns")}
      >
        {showPatterns ? <Eye size={14} /> : <EyeOff size={14} />}
        <span className="tree-toolbar__btn-label">{t("toolbar.patterns")}</span>
      </button>
      <button
        type="button"
        className={filterPanelOpen ? ICON_BTN_ACTIVE : ICON_BTN}
        onClick={onToggleFilterPanel}
        aria-label={t("timeline.filter")}
      >
        <Filter size={14} />
        <span className="tree-toolbar__btn-label">{t("toolbar.filter")}</span>
        {activeFilterCount > 0 && <span className="tl-filter-badge">{activeFilterCount}</span>}
      </button>
      <button
        type="button"
        className={journalPanelOpen ? ICON_BTN_ACTIVE : ICON_BTN}
        onClick={onToggleJournal}
        aria-label={t("journal.tab")}
      >
        <BookOpen size={14} />
        <span className="tree-toolbar__btn-label">{t("toolbar.journal")}</span>
      </button>
    </>
  );
}

/* -- Timeline local state -------------------------------------------------- */

interface TimelineLocalState {
  layoutMode: LayoutMode;
  scrollMode: boolean;
  mode: TimelineMode;
  focusedMarker: MarkerClickInfo | null;
  filterPanelOpen: boolean;
  selectedEntityKeys: Set<string>;
  showPatterns: boolean;
  focusedPatternId: string | null;
}

type TimelineLocalAction =
  | { type: "SET_LAYOUT_MODE"; layoutMode: LayoutMode }
  | { type: "SET_SCROLL_MODE"; scrollMode: boolean }
  | { type: "SET_MODE"; mode: TimelineMode }
  | { type: "SET_FOCUSED_MARKER"; focusedMarker: MarkerClickInfo | null }
  | { type: "SET_FILTER_PANEL_OPEN"; filterPanelOpen: boolean }
  | { type: "SET_SELECTED_ENTITY_KEYS"; selectedEntityKeys: Set<string> }
  | { type: "TOGGLE_ENTITY_KEY"; key: string }
  | { type: "TOGGLE_SHOW_PATTERNS" }
  | { type: "TOGGLE_FILTER_PANEL" }
  | { type: "SET_FOCUSED_PATTERN_ID"; focusedPatternId: string | null };

const timelineInitialState: TimelineLocalState = {
  layoutMode: "years",
  scrollMode: false,
  mode: "explore",
  focusedMarker: null,
  filterPanelOpen: false,
  selectedEntityKeys: new Set(),
  showPatterns: true,
  focusedPatternId: null,
};

function timelineLocalReducer(
  state: TimelineLocalState,
  action: TimelineLocalAction,
): TimelineLocalState {
  switch (action.type) {
    case "SET_LAYOUT_MODE":
      return { ...state, layoutMode: action.layoutMode };
    case "SET_SCROLL_MODE":
      return { ...state, scrollMode: action.scrollMode };
    case "SET_MODE":
      return action.mode === state.mode
        ? state
        : {
            ...state,
            mode: action.mode,
            selectedEntityKeys: action.mode !== "annotate" ? new Set() : state.selectedEntityKeys,
          };
    case "SET_FOCUSED_MARKER":
      return { ...state, focusedMarker: action.focusedMarker };
    case "SET_FILTER_PANEL_OPEN":
      return { ...state, filterPanelOpen: action.filterPanelOpen };
    case "SET_SELECTED_ENTITY_KEYS":
      return { ...state, selectedEntityKeys: action.selectedEntityKeys };
    case "TOGGLE_ENTITY_KEY": {
      const next = new Set(state.selectedEntityKeys);
      if (next.has(action.key)) next.delete(action.key);
      else next.add(action.key);
      return { ...state, selectedEntityKeys: next };
    }
    case "TOGGLE_SHOW_PATTERNS":
      return { ...state, showPatterns: !state.showPatterns };
    case "TOGGLE_FILTER_PANEL":
      return { ...state, filterPanelOpen: !state.filterPanelOpen };
    case "SET_FOCUSED_PATTERN_ID":
      return { ...state, focusedPatternId: action.focusedPatternId };
  }
}

/* -- Derived data hook ----------------------------------------------------- */

function useTimelineDerivedData(
  persons: Map<string, DecryptedPerson>,
  relationships: Map<string, DecryptedRelationship>,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  turningPoints: Map<string, DecryptedTurningPoint>,
  classifications: Map<string, DecryptedClassification>,
  patterns: Map<string, Pattern>,
  showPatterns: boolean,
  visiblePatternsFilter: Set<string> | null,
  hoveredPatternId: string | null,
) {
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
  const visiblePatternIds = useMemo(() => {
    if (!showPatterns) return new Set<string>();
    if (visiblePatternsFilter !== null) return visiblePatternsFilter;
    return new Set(patterns.keys());
  }, [showPatterns, patterns, visiblePatternsFilter]);
  const effectiveVisiblePatternIds = useMemo(() => {
    if (!hoveredPatternId || visiblePatternIds.has(hoveredPatternId)) return visiblePatternIds;
    return new Set([...visiblePatternIds, hoveredPatternId]);
  }, [visiblePatternIds, hoveredPatternId]);

  return {
    timeDomain,
    smartGroups,
    usedTraumaCategories,
    usedLifeEventCategories,
    usedClassifications,
    visiblePatternIds,
    effectiveVisiblePatternIds,
  };
}

/* -- Timeline handlers hook ------------------------------------------------ */

function useTimelineHandlers(
  dispatch: Dispatch<TimelineLocalAction>,
  localRef: RefObject<TimelineLocalState>,
  panels: ReturnType<typeof useWorkspacePanels>,
  selectedPersonId: string | null,
  setSelectedPersonId: (id: string | null) => void,
  filterActions: { togglePatternFilter: (id: string) => void },
  selectedEntityKeys: Set<string>,
  mode: TimelineMode,
  relationships: Map<string, DecryptedRelationship>,
  events: Map<string, DecryptedEvent>,
  lifeEvents: Map<string, DecryptedLifeEvent>,
  turningPoints: Map<string, DecryptedTurningPoint>,
  classifications: Map<string, DecryptedClassification>,
  mutations: ReturnType<typeof useTreeMutations>,
) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const s = localRef.current;
      if (s.selectedEntityKeys.size > 0) {
        dispatch({ type: "SET_SELECTED_ENTITY_KEYS", selectedEntityKeys: new Set() });
        return;
      }
      if (panels.journalPanelOpen) {
        panels.setJournalPanelOpen(false);
        return;
      }
      if (panels.patternPanelOpen) {
        panels.setPatternPanelOpen(false);
        dispatch({ type: "SET_FOCUSED_PATTERN_ID", focusedPatternId: null });
        return;
      }
      if (selectedPersonId) {
        setSelectedPersonId(null);
        return;
      }
      if (s.filterPanelOpen) {
        dispatch({ type: "SET_FILTER_PANEL_OPEN", filterPanelOpen: false });
        return;
      }
      if (s.mode === "edit" || s.mode === "annotate") {
        dispatch({ type: "SET_MODE", mode: "explore" });
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dispatch, localRef, panels, selectedPersonId, setSelectedPersonId]);

  const handleTogglePatternVisibility = useCallback(
    (patternId: string) => {
      filterActions.togglePatternFilter(patternId);
    },
    [filterActions],
  );

  const handleToggleScrollMode = useCallback(() => {
    dispatch({ type: "SET_SCROLL_MODE", scrollMode: !localRef.current.scrollMode });
  }, [dispatch, localRef]);

  const handleToggleEntitySelect = useCallback(
    (key: string) => {
      dispatch({ type: "TOGGLE_ENTITY_KEY", key });
    },
    [dispatch],
  );

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
      dispatch({ type: "SET_SELECTED_ENTITY_KEYS", selectedEntityKeys: new Set() });
    },
    [selectedEntityKeys, events, lifeEvents, turningPoints, classifications, mutations, dispatch],
  );

  const handleClickPartnerLine = useCallback(
    (relationshipId: string) => {
      if (mode !== "edit") return;
      const rel = relationships.get(relationshipId);
      if (!rel) return;
      setSelectedPersonId(rel.source_person_id);
      panels.setInitialSection("relationships");
      dispatch({ type: "SET_FILTER_PANEL_OPEN", filterPanelOpen: false });
    },
    [mode, relationships, setSelectedPersonId, panels, dispatch],
  );

  const handlePatternClick = useCallback(
    (patternId: string) => {
      dispatch({ type: "SET_FOCUSED_PATTERN_ID", focusedPatternId: patternId });
      panels.setPatternPanelOpen(true);
    },
    [panels, dispatch],
  );

  const handleSelectPerson = useCallback(
    (personId: string | null) => {
      setSelectedPersonId(personId);
      dispatch({ type: "SET_FOCUSED_MARKER", focusedMarker: null });
      if (personId && localRef.current.mode === "edit") {
        panels.setInitialSection("person");
        dispatch({ type: "SET_FILTER_PANEL_OPEN", filterPanelOpen: false });
      }
    },
    [setSelectedPersonId, panels, dispatch, localRef],
  );

  const handleClickMarker = useCallback(
    (info: MarkerClickInfo) => {
      const m = localRef.current.mode;
      if (m === "explore") {
        dispatch({
          type: "SET_FOCUSED_MARKER",
          focusedMarker: localRef.current.focusedMarker?.entityId === info.entityId ? null : info,
        });
      } else if (m === "edit") {
        setSelectedPersonId(info.personId);
        panels.setInitialSection(info.entityType);
        dispatch({ type: "SET_FILTER_PANEL_OPEN", filterPanelOpen: false });
      }
    },
    [setSelectedPersonId, panels, dispatch, localRef],
  );

  const handleSetMode = useCallback(
    (newMode: TimelineMode) => {
      dispatch({ type: "SET_MODE", mode: newMode });
      setSelectedPersonId(null);
    },
    [setSelectedPersonId, dispatch],
  );

  return {
    handleTogglePatternVisibility,
    handleToggleScrollMode,
    handleToggleEntitySelect,
    handleCreatePattern,
    handleClickPartnerLine,
    handlePatternClick,
    handleSelectPerson,
    handleClickMarker,
    handleSetMode,
  };
}

/* -- Main component -------------------------------------------------------- */

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

  const [local, dispatch] = useReducer(timelineLocalReducer, timelineInitialState);
  const {
    layoutMode,
    scrollMode,
    mode,
    focusedMarker,
    filterPanelOpen,
    selectedEntityKeys,
    showPatterns,
    focusedPatternId,
  } = local;

  const { settings: canvasSettings } = useCanvasSettings();

  const {
    filters,
    actions: filterActions,
    dims,
  } = useTimelineFilters(persons, events, lifeEvents, turningPoints, classifications, patterns);

  const {
    timeDomain,
    smartGroups,
    usedTraumaCategories,
    usedLifeEventCategories,
    usedClassifications,
    effectiveVisiblePatternIds,
  } = useTimelineDerivedData(
    persons,
    relationships,
    events,
    lifeEvents,
    turningPoints,
    classifications,
    patterns,
    showPatterns,
    filters.visiblePatterns,
    panels.hoveredPatternId,
  );

  const selectedPerson = selectedPersonId ? (persons.get(selectedPersonId) ?? null) : null;

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

  const localRef = useRef(local);
  localRef.current = local;

  const {
    handleTogglePatternVisibility,
    handleToggleScrollMode,
    handleToggleEntitySelect,
    handleCreatePattern,
    handleClickPartnerLine,
    handlePatternClick,
    handleSelectPerson,
    handleClickMarker,
    handleSetMode,
  } = useTimelineHandlers(
    dispatch,
    localRef,
    panels,
    selectedPersonId,
    setSelectedPersonId,
    filterActions,
    selectedEntityKeys,
    mode,
    relationships,
    events,
    lifeEvents,
    turningPoints,
    classifications,
    mutations,
  );

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
        <LayoutModeTabs
          layoutMode={layoutMode}
          onSetLayoutMode={(m) => dispatch({ type: "SET_LAYOUT_MODE", layoutMode: m })}
        />
        <InteractionModeTabs mode={mode} onSetMode={handleSetMode} />
        <div className="tree-toolbar__separator" />
        <ToolbarActionButtons
          showPatterns={showPatterns}
          onTogglePatterns={() => dispatch({ type: "TOGGLE_SHOW_PATTERNS" })}
          filterPanelOpen={filterPanelOpen}
          onToggleFilterPanel={() => dispatch({ type: "TOGGLE_FILTER_PANEL" })}
          activeFilterCount={filterActions.activeFilterCount}
          journalPanelOpen={panels.journalPanelOpen}
          onToggleJournal={() => panels.setJournalPanelOpen((v) => !v)}
        />
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
            onClose={() => dispatch({ type: "SET_FOCUSED_MARKER", focusedMarker: null })}
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
            onCancel={() =>
              dispatch({ type: "SET_SELECTED_ENTITY_KEYS", selectedEntityKeys: new Set() })
            }
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
            onClose={() => dispatch({ type: "SET_FILTER_PANEL_OPEN", filterPanelOpen: false })}
          />
        )}

        <WorkspacePanelHost
          panels={panels}
          handlers={entityHandlers}
          entities={selectedEntities}
          treeData={treeData}
          visiblePatternIds={effectiveVisiblePatternIds}
          onTogglePatternVisibility={handleTogglePatternVisibility}
          initialExpandedPatternId={focusedPatternId}
          showReflectionPrompts={canvasSettings.showReflectionPrompts}
          showPersonPanel={mode === "edit"}
          onClosePatternPanel={() => {
            panels.setPatternPanelOpen(false);
            dispatch({ type: "SET_FOCUSED_PATTERN_ID", focusedPatternId: null });
          }}
        />
      </div>
    </div>
  );
}
