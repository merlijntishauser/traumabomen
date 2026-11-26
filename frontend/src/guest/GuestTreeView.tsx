import {
  Background,
  Controls,
  type NodeMouseHandler,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FamilyStripesView } from "../components/familyStripes/FamilyStripesView";
import { PatternView } from "../components/PatternView";
import { DemoPersonCard } from "../components/tree/DemoPersonCard";
import { PatternFocusMenu } from "../components/tree/PatternFocusMenu";
import { PatternFocusPanel } from "../components/tree/PatternFocusPanel";
import { PersonNode } from "../components/tree/PersonNode";
import { RelationshipEdge } from "../components/tree/RelationshipEdge";
import SiblingGroupNode from "../components/tree/SiblingGroupNode";
import { applyPatternFocusToNodes } from "../hooks/usePatternFocus";
import type { PersonNodeType, SiblingGroupNodeType } from "../hooks/useTreeLayout";
import { useTreeLayout } from "../hooks/useTreeLayout";
import type { GuestTreeState } from "../lib/guestCopy";
import { getPatternColor } from "../lib/patternColors";
import type { EntityMaps } from "../lib/patternEntities";
import "../components/tree/TreeCanvas.css";
import "./GuestTreeView.css";

const nodeTypes = { person: PersonNode, siblingGroup: SiblingGroupNode };
const edgeTypes = { relationship: RelationshipEdge };
const LAYOUT_SETTINGS = { edgeStyle: "curved", showMarkers: true } as const;
// PatternView wants a tree id for its links into the app; the guest page renders none.
const NO_TREE_ID = "00000000-0000-0000-0000-000000000000";

type GuestTab = "tree" | "timeline" | "patterns";
type GuestNode = PersonNodeType | SiblingGroupNodeType;

interface GuestTreeViewProps {
  state: GuestTreeState;
  /** ISO timestamp of the publish this copy came from. */
  publishedAt: string;
}

function GuestCanvas({
  state,
  selectedId,
  onSelect,
  focusedPatternId,
  onClearFocus,
}: {
  state: GuestTreeState;
  selectedId: string | null;
  onSelect: (personId: string | null) => void;
  focusedPatternId: string | null;
  onClearFocus: () => void;
}) {
  const { fitView } = useReactFlow();
  const { nodes, edges } = useTreeLayout(
    state.persons,
    state.relationships,
    state.events,
    selectedId,
    state.lifeEvents,
    LAYOUT_SETTINGS,
    state.classifications,
    state.turningPoints,
    state.siblingGroups,
  );

  const focusedPattern = focusedPatternId ? (state.patterns.get(focusedPatternId) ?? null) : null;
  const focusColor = focusedPattern ? getPatternColor(focusedPattern.color) : null;
  const focusMemberIds = useMemo(
    () => (focusedPattern ? new Set(focusedPattern.person_ids) : null),
    [focusedPattern],
  );
  const displayNodes = useMemo(
    () => applyPatternFocusToNodes(nodes, focusMemberIds, focusColor),
    [nodes, focusMemberIds, focusColor],
  );
  const entityMaps: EntityMaps = useMemo(
    () => ({
      events: state.events,
      lifeEvents: state.lifeEvents,
      turningPoints: state.turningPoints,
      classifications: state.classifications,
      persons: state.persons,
    }),
    [state.events, state.lifeEvents, state.turningPoints, state.classifications, state.persons],
  );

  useEffect(() => {
    const timer = setTimeout(() => fitView({ padding: 0.2 }), 50);
    return () => clearTimeout(timer);
  }, [fitView]);

  const onNodeClick = useCallback<NodeMouseHandler<GuestNode>>(
    (_event, node) => {
      if (node.type === "person") onSelect(node.id);
    },
    [onSelect],
  );

  return (
    <>
      <ReactFlow
        className={focusedPattern ? "tree-canvas--focused" : undefined}
        nodes={displayNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={() => onSelect(null)}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        deleteKeyCode={null}
        minZoom={0.2}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
      {focusedPattern && focusColor && (
        <PatternFocusPanel
          pattern={focusedPattern}
          color={focusColor}
          entityMaps={entityMaps}
          onExit={onClearFocus}
        />
      )}
    </>
  );
}

/**
 * The guest page's read-only views of a published copy: the canvas, the family
 * stripes and the patterns, in tabs held in local state (no router). Nothing here
 * writes, exports or links into the app.
 */
export function GuestTreeView({ state, publishedAt }: GuestTreeViewProps) {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<GuestTab>("tree");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusedPatternId, setFocusedPatternId] = useState<string | null>(null);

  const published = useMemo(() => {
    const date = new Date(publishedAt);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat(i18n.language, { dateStyle: "long" }).format(date);
  }, [publishedAt, i18n.language]);

  const selectedPerson = selectedId ? (state.persons.get(selectedId) ?? null) : null;
  const tabs: { id: GuestTab; label: string }[] = [
    { id: "tree", label: t("guest.view.tree") },
    { id: "timeline", label: t("tree.timeline") },
    { id: "patterns", label: t("guest.view.patterns") },
  ];

  return (
    <div className="guest-view">
      <header className="guest-view__bar">
        <h1 className="guest-view__name">{state.treeName}</h1>
        <p className="guest-view__label">{t("guest.view.viewOnly", { date: published })}</p>
        <div className="guest-view__tabs" role="tablist" aria-label={t("guest.view.tabsLabel")}>
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              className="guest-view__tab"
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
        {tab === "tree" && state.patterns.size > 0 && (
          <PatternFocusMenu
            patterns={state.patterns}
            focusedPatternId={focusedPatternId}
            onFocus={setFocusedPatternId}
            label={t("demo.live.patterns")}
          />
        )}
      </header>
      <div className="guest-view__body" role="tabpanel">
        {tab === "tree" && (
          <ReactFlowProvider>
            <GuestCanvas
              state={state}
              selectedId={selectedId}
              onSelect={setSelectedId}
              focusedPatternId={focusedPatternId}
              onClearFocus={() => setFocusedPatternId(null)}
            />
          </ReactFlowProvider>
        )}
        {tab === "timeline" && (
          <FamilyStripesView
            persons={state.persons}
            relationships={state.relationships}
            events={state.events}
            lifeEvents={state.lifeEvents}
            classifications={state.classifications}
            turningPoints={state.turningPoints}
            onOpenPerson={setSelectedId}
            onOpenEntry={(_entry, personId) => setSelectedId(personId)}
          />
        )}
        {tab === "patterns" && (
          <PatternView
            treeId={NO_TREE_ID}
            patterns={state.patterns}
            events={state.events}
            lifeEvents={state.lifeEvents}
            turningPoints={state.turningPoints}
            classifications={state.classifications}
            persons={state.persons}
            showReflectionPrompts={false}
            readOnly
            linksToApp={false}
          />
        )}
        {selectedPerson && (
          <DemoPersonCard
            person={selectedPerson}
            state={state}
            linksToApp={false}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}
