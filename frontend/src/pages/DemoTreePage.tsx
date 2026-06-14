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
import { Link } from "react-router-dom";
import { BackHome } from "../components/BackHome";
import { DemoPersonCard } from "../components/tree/DemoPersonCard";
import { PatternFocusMenu } from "../components/tree/PatternFocusMenu";
import { PatternFocusPanel } from "../components/tree/PatternFocusPanel";
import { PersonNode } from "../components/tree/PersonNode";
import { RelationshipEdge } from "../components/tree/RelationshipEdge";
import SiblingGroupNode from "../components/tree/SiblingGroupNode";
import { useDemoTreeData } from "../hooks/useDemoTreeData";
import { usePatternFocus } from "../hooks/usePatternFocus";
import type { PersonNodeType, SiblingGroupNodeType } from "../hooks/useTreeLayout";
import { useTreeLayout } from "../hooks/useTreeLayout";
import type { DemoTreeState } from "../lib/buildDemoState";
import type { EntityMaps } from "../lib/patternEntities";
import "../components/tree/TreeCanvas.css";
import "./DemoTreePage.css";

const nodeTypes = { person: PersonNode, siblingGroup: SiblingGroupNode };
const edgeTypes = { relationship: RelationshipEdge };
const LAYOUT_SETTINGS = { edgeStyle: "curved", showMarkers: true } as const;

type DemoNode = PersonNodeType | SiblingGroupNodeType;

function DemoCanvas({ state }: { state: DemoTreeState }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  // Same single-pattern spotlight the workspace uses: dim everyone, light up one
  // pattern's members in its colour. Read-only here (no manage / edit).
  const { focusedPatternId, setFocusedPatternId, focusedPattern, focusColor, displayNodes } =
    usePatternFocus(state.patterns, nodes, null);

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

  // Frame the whole family once the layout is ready.
  useEffect(() => {
    const timer = setTimeout(() => fitView({ padding: 0.2 }), 50);
    return () => clearTimeout(timer);
  }, [fitView]);

  const onNodeClick = useCallback<NodeMouseHandler<DemoNode>>((_event, node) => {
    if (node.type === "person") setSelectedId(node.id);
  }, []);

  const selectedPerson = selectedId ? (state.persons.get(selectedId) ?? null) : null;

  return (
    <>
      <ReactFlow
        className={focusedPattern ? "tree-canvas--focused" : undefined}
        nodes={displayNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onPaneClick={() => setSelectedId(null)}
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
      {state.patterns.size > 0 && (
        <div className="demo-canvas__tools">
          <PatternFocusMenu
            patterns={state.patterns}
            focusedPatternId={focusedPatternId}
            onFocus={setFocusedPatternId}
          />
        </div>
      )}
      {focusedPattern && focusColor && (
        <PatternFocusPanel
          pattern={focusedPattern}
          color={focusColor}
          entityMaps={entityMaps}
          onExit={() => setFocusedPatternId(null)}
        />
      )}
      {selectedPerson && (
        <DemoPersonCard person={selectedPerson} state={state} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}

/**
 * Public, read-only demo tree: a fictional family a logged-out visitor can pan,
 * zoom, and click. Builds its data from the bundled fixture (no API, no
 * encryption, no master key) and renders the real canvas components read-only.
 */
export default function DemoTreePage() {
  const { t, i18n } = useTranslation();
  const state = useDemoTreeData(i18n.language);

  useEffect(() => {
    const previousTitle = document.title;
    const meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute("content") ?? null;
    document.title = `${t("demo.live.title")} | ${t("app.title")}`;
    meta?.setAttribute("content", t("demo.live.metaDescription"));
    return () => {
      document.title = previousTitle;
      if (previousDescription !== null) meta?.setAttribute("content", previousDescription);
    };
  }, [t]);

  return (
    <div className="demo-page">
      <header className="demo-page__bar">
        <BackHome />
        <p className="demo-page__note">{t("demo.live.banner")}</p>
        <div className="demo-page__actions">
          <Link to="/register" className="btn btn--primary demo-page__cta">
            {t("demo.live.cta")}
          </Link>
        </div>
      </header>
      <div className="demo-page__canvas">
        {state ? (
          <ReactFlowProvider>
            <DemoCanvas state={state} />
          </ReactFlowProvider>
        ) : (
          <div className="demo-page__loading">{t("common.loading")}</div>
        )}
      </div>
    </div>
  );
}
