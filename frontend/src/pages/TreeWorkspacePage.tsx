import { useQueryClient } from "@tanstack/react-query";
import {
  applyNodeChanges,
  Background,
  type Connection,
  Controls,
  MiniMap,
  type OnConnect,
  type OnNodesChange,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { TreePine, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { BranchDecoration } from "../components/tree/BranchDecoration";
import { CanvasSettingsContent } from "../components/tree/CanvasSettingsContent";
import { CanvasToolbarButtons } from "../components/tree/CanvasToolbarButtons";
import { PatternConnectors } from "../components/tree/PatternConnectors";
import type { PersonDetailSection } from "../components/tree/PersonDetailPanel";
import { PersonNode } from "../components/tree/PersonNode";
import { ReflectionNudge } from "../components/tree/ReflectionNudge";
import { RelationshipDetailPanel } from "../components/tree/RelationshipDetailPanel";
import { RelationshipEdge } from "../components/tree/RelationshipEdge";
import { RelationshipPopover } from "../components/tree/RelationshipPopover";
import { RelationshipPrompt } from "../components/tree/RelationshipPrompt";
import SiblingGroupNode from "../components/tree/SiblingGroupNode";
import { SiblingGroupPanel } from "../components/tree/SiblingGroupPanel";
import { TreeToolbar } from "../components/tree/TreeToolbar";
import { WorkspacePanelHost } from "../components/WorkspacePanelHost";
import { useCanvasSettings } from "../hooks/useCanvasSettings";
import { useExportTree } from "../hooks/useExportTree";
import { useLinkedEntityPanelHandlers } from "../hooks/useLinkedEntityPanelHandlers";
import type { PositionSnapshot } from "../hooks/usePositionHistory";
import { usePositionHistory } from "../hooks/usePositionHistory";
import { usePromoteMember } from "../hooks/usePromoteMember";
import { useSelectedPersonEntities } from "../hooks/useSelectedPersonEntities";
import type { DecryptedPerson } from "../hooks/useTreeData";
import { filterByPerson, treeQueryKeys, useTreeData } from "../hooks/useTreeData";
import { useTreeId } from "../hooks/useTreeId";
import type {
  PersonNodeType,
  RelationshipEdgeType,
  SiblingGroupNodeType,
} from "../hooks/useTreeLayout";
import { filterEdgesByVisibility, useTreeLayout } from "../hooks/useTreeLayout";
import { linkedEntityHandlers, useTreeMutations } from "../hooks/useTreeMutations";
import { useWorkspacePanels } from "../hooks/useWorkspacePanels";
import type {
  Person,
  RelationshipData,
  RelationshipType,
  SiblingGroupMember,
} from "../types/domain";
import "../components/tree/TreeCanvas.css";

const nodeTypes = { person: PersonNode, siblingGroup: SiblingGroupNode };
const edgeTypes = { relationship: RelationshipEdge };

const NODE_W = 180;
const NODE_H = 80;
const PLACEMENT_STEP = 40;

// Pre-built ring offsets for finding free positions (rings 1-8 around origin)
const RING_OFFSETS: { dx: number; dy: number }[] = [];
for (let r = 1; r <= 8; r++) {
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      if (Math.abs(dx) === r || Math.abs(dy) === r) {
        RING_OFFSETS.push({ dx, dy });
      }
    }
  }
}

function hasOverlap(
  px: number,
  py: number,
  occupied: { position: { x: number; y: number } }[],
): boolean {
  return occupied.some(
    (n) =>
      px < n.position.x + NODE_W &&
      px + NODE_W > n.position.x &&
      py < n.position.y + NODE_H &&
      py + NODE_H > n.position.y,
  );
}

function findFreePosition(
  center: { x: number; y: number },
  occupied: { position: { x: number; y: number } }[],
): { x: number; y: number } {
  const origin = { x: center.x - NODE_W / 2, y: center.y - NODE_H / 2 };
  if (!hasOverlap(origin.x, origin.y, occupied)) return origin;

  for (const { dx, dy } of RING_OFFSETS) {
    const cx = origin.x + dx * PLACEMENT_STEP;
    const cy = origin.y + dy * PLACEMENT_STEP;
    if (!hasOverlap(cx, cy, occupied)) return { x: cx, y: cy };
  }

  return origin;
}

/* -- Canvas interaction state ---------------------------------------------- */

interface CanvasInteractionState {
  selectedEdgeId: string | null;
  pendingConnection: Connection | null;
  relationshipPromptPersonId: string | null;
  initialEntityId: string | null;
  openSiblingGroupId: string | null;
  animatingLayout: boolean;
}

type CanvasInteractionAction =
  | { type: "SELECT_EDGE"; id: string | null }
  | { type: "SET_PENDING_CONNECTION"; connection: Connection | null }
  | { type: "SWAP_PENDING_CONNECTION" }
  | { type: "SET_RELATIONSHIP_PROMPT"; personId: string | null }
  | { type: "SET_INITIAL_ENTITY"; id: string | null }
  | { type: "SET_OPEN_SIBLING_GROUP"; id: string | null }
  | { type: "SET_ANIMATING_LAYOUT"; value: boolean }
  | { type: "DISMISS_ALL" }
  | { type: "NODE_CLICKED"; entityId: string | null };

const canvasInteractionInitialState: CanvasInteractionState = {
  selectedEdgeId: null,
  pendingConnection: null,
  relationshipPromptPersonId: null,
  initialEntityId: null,
  openSiblingGroupId: null,
  animatingLayout: false,
};

function canvasInteractionReducer(
  state: CanvasInteractionState,
  action: CanvasInteractionAction,
): CanvasInteractionState {
  switch (action.type) {
    case "SELECT_EDGE":
      return { ...state, selectedEdgeId: action.id };
    case "SET_PENDING_CONNECTION":
      return { ...state, pendingConnection: action.connection };
    case "SWAP_PENDING_CONNECTION":
      if (!state.pendingConnection) return state;
      return {
        ...state,
        pendingConnection: {
          ...state.pendingConnection,
          source: state.pendingConnection.target,
          target: state.pendingConnection.source,
        },
      };
    case "SET_RELATIONSHIP_PROMPT":
      return { ...state, relationshipPromptPersonId: action.personId };
    case "SET_INITIAL_ENTITY":
      return { ...state, initialEntityId: action.id };
    case "SET_OPEN_SIBLING_GROUP":
      return { ...state, openSiblingGroupId: action.id };
    case "SET_ANIMATING_LAYOUT":
      return { ...state, animatingLayout: action.value };
    case "DISMISS_ALL":
      return {
        ...state,
        selectedEdgeId: null,
        pendingConnection: null,
        relationshipPromptPersonId: null,
        openSiblingGroupId: null,
      };
    case "NODE_CLICKED":
      return {
        ...state,
        selectedEdgeId: null,
        initialEntityId: action.entityId,
      };
  }
}

/* -- Sub-components -------------------------------------------------------- */

function EmptyCanvasState({ onAddPerson }: { onAddPerson: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="tree-canvas-empty">
      <TreePine size={32} strokeWidth={1.5} color="var(--color-text-muted)" />
      <h2 className="tree-canvas-empty__title">{t("tree.canvasEmpty")}</h2>
      <p className="tree-canvas-empty__hint">{t("tree.canvasEmptyHint")}</p>
      <button type="button" className="tree-canvas-empty__btn" onClick={onAddPerson}>
        <UserPlus size={16} />
        {t("tree.addPerson")}
      </button>
    </div>
  );
}

/* -- Extracted hooks -------------------------------------------------------- */

type AnyNodeType = PersonNodeType | SiblingGroupNodeType;

function useCanvasNodes(
  layoutNodes: AnyNodeType[],
  edgeCount: number,
  fitView: ReturnType<typeof useReactFlow>["fitView"],
) {
  const [nodes, setNodes] = useState<AnyNodeType[]>([]);
  const prevNodeIdsRef = useRef("");
  const prevEdgeCountRef = useRef(0);
  const prevNodeCountRef = useRef(0);
  const layoutRevisionRef = useRef(0);
  const prevLayoutRevisionRef = useRef(0);

  useEffect(() => {
    const currentIds = layoutNodes
      .map((n) => n.id)
      .sort()
      .join(",");
    const nodesChanged = currentIds !== prevNodeIdsRef.current;
    const edgesChanged = edgeCount !== prevEdgeCountRef.current;
    const layoutRevisionChanged = layoutRevisionRef.current !== prevLayoutRevisionRef.current;
    const structureChanged = nodesChanged || edgesChanged || layoutRevisionChanged;
    prevNodeIdsRef.current = currentIds;
    prevEdgeCountRef.current = edgeCount;
    prevLayoutRevisionRef.current = layoutRevisionRef.current;

    setNodes((prev) => {
      const prevMap = new Map(prev.map((n) => [n.id, n]));
      return layoutNodes.map((n) => {
        const existing = prevMap.get(n.id);
        if (!existing) return n;
        if (structureChanged) {
          return { ...n, measured: existing.measured };
        }
        return { ...n, position: existing.position, measured: existing.measured };
      });
    });
  }, [layoutNodes, edgeCount]);

  const onNodesChange: OnNodesChange<AnyNodeType> = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  useEffect(() => {
    if (layoutNodes.length > 0 && layoutNodes.length !== prevNodeCountRef.current) {
      prevNodeCountRef.current = layoutNodes.length;
      const timer = setTimeout(() => fitView({ padding: 0.2 }), 50);
      return () => clearTimeout(timer);
    }
  }, [layoutNodes.length, fitView]);

  return { nodes, onNodesChange, layoutRevisionRef };
}

function useCanvasActions(opts: {
  treeId: string;
  persons: Map<string, DecryptedPerson>;
  siblingGroups: ReturnType<typeof useTreeData>["siblingGroups"];
  mutations: ReturnType<typeof useTreeMutations>;
  nodes: AnyNodeType[];
  layoutRevisionRef: React.MutableRefObject<number>;
  canvasSettings: ReturnType<typeof useCanvasSettings>["settings"];
  dispatchCanvas: React.Dispatch<CanvasInteractionAction>;
  setSelectedPersonId: (id: string | null) => void;
  panels: {
    setPatternPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  };
  screenToFlowPosition: ReturnType<typeof useReactFlow>["screenToFlowPosition"];
  pushPositionSnapshot: (snapshot: PositionSnapshot) => void;
  popPositionSnapshot: () => PositionSnapshot | undefined;
}) {
  const {
    treeId,
    persons,
    siblingGroups,
    mutations,
    nodes,
    layoutRevisionRef,
    canvasSettings,
    dispatchCanvas,
    setSelectedPersonId,
    panels,
    screenToFlowPosition,
    pushPositionSnapshot,
    popPositionSnapshot,
  } = opts;
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const siblingGroupHandlers = useMemo(
    () => linkedEntityHandlers(mutations.siblingGroups),
    [mutations.siblingGroups],
  );

  const promoteMember = usePromoteMember(treeId);

  const handleNodeDragStart = useCallback(
    (_: React.MouseEvent, node: AnyNodeType) => {
      if (node.type === "siblingGroup") return;
      const person = persons.get(node.id);
      if (!person) return;
      const snapshot: PositionSnapshot = new Map([[node.id, person.position]]);
      pushPositionSnapshot(snapshot);
    },
    [persons, pushPositionSnapshot],
  );

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: AnyNodeType) => {
      const position = { x: node.position.x, y: node.position.y };

      if (node.type === "siblingGroup") {
        const groupId = node.id.replace("sibling-group-", "");
        const group = siblingGroups.get(groupId);
        if (!group) return;
        siblingGroupHandlers.save(groupId, { members: group.members, position }, group.person_ids);
        return;
      }

      const person = persons.get(node.id);
      if (!person) return;

      queryClient.setQueryData(
        treeQueryKeys.persons(treeId),
        (old: Map<string, DecryptedPerson> | undefined) => {
          if (!old) return old;
          const next = new Map(old);
          next.set(node.id, { ...person, position });
          return next;
        },
      );

      const { id, ...data } = person;
      mutations.updatePerson.mutate({ personId: id, data: { ...data, position } });
    },
    [persons, siblingGroups, siblingGroupHandlers, queryClient, treeId, mutations.updatePerson],
  );

  function handleAddPerson() {
    const panelWidth = 400;
    const visibleCenterX = (window.innerWidth - panelWidth) / 2;
    const visibleCenterY = window.innerHeight / 2;
    const flowPos = screenToFlowPosition({ x: visibleCenterX, y: visibleCenterY });
    const position = findFreePosition(flowPos, nodes);

    const newPerson: Person = {
      name: t("person.newPerson"),
      birth_year: null,
      birth_month: null,
      birth_day: null,
      death_year: null,
      death_month: null,
      death_day: null,
      cause_of_death: null,
      gender: "",
      is_adopted: false,
      notes: null,
      position,
    };
    mutations.createPerson.mutate(newPerson, {
      onSuccess: (response) => {
        setSelectedPersonId(response.id);
        panels.setPatternPanelOpen(false);
        if (canvasSettings.promptRelationship && persons.size > 0) {
          dispatchCanvas({ type: "SET_RELATIONSHIP_PROMPT", personId: response.id });
        }
      },
    });
  }

  const applyPositions = useCallback(
    (positionMap: PositionSnapshot) => {
      layoutRevisionRef.current += 1;

      dispatchCanvas({ type: "SET_ANIMATING_LAYOUT", value: true });
      setTimeout(() => dispatchCanvas({ type: "SET_ANIMATING_LAYOUT", value: false }), 350);

      queryClient.setQueryData(
        treeQueryKeys.persons(treeId),
        (old: Map<string, DecryptedPerson> | undefined) => {
          if (!old) return old;
          const next = new Map(old);
          for (const [personId, position] of positionMap) {
            const person = next.get(personId);
            if (!person) continue;
            if (position) {
              next.set(personId, { ...person, position });
            } else {
              const rest = { ...person };
              delete rest.position;
              next.set(personId, rest as DecryptedPerson);
            }
          }
          return next;
        },
      );

      const batch: { personId: string; data: Person }[] = [];
      for (const [personId, position] of positionMap) {
        const person = persons.get(personId);
        if (!person) continue;
        const { id, ...data } = person;
        delete data.position;
        batch.push({ personId: id, data: position ? { ...data, position } : data });
      }
      if (batch.length > 0) {
        mutations.batchUpdatePersons.mutate(batch);
      }
    },
    [queryClient, treeId, persons, mutations.batchUpdatePersons, layoutRevisionRef, dispatchCanvas],
  );

  function handleAutoLayout() {
    const pinnedPersons = Array.from(persons.values()).filter((p) => p.position);
    if (pinnedPersons.length === 0) return;

    const snapshot: PositionSnapshot = new Map();
    for (const p of persons.values()) {
      snapshot.set(p.id, p.position);
    }
    pushPositionSnapshot(snapshot);

    const clearMap: PositionSnapshot = new Map(pinnedPersons.map((p) => [p.id, undefined]));
    applyPositions(clearMap);
  }

  const handleUndo = useCallback(() => {
    const snapshot = popPositionSnapshot();
    if (!snapshot) return;
    applyPositions(snapshot);
  }, [popPositionSnapshot, applyPositions]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        handleUndo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo]);

  const selectedPersonSiblingGroup = useCallback(
    (selectedPersonId: string | null) => {
      if (!selectedPersonId) return null;
      const groups = filterByPerson(siblingGroups, selectedPersonId);
      return groups.length > 0 ? groups[0] : null;
    },
    [siblingGroups],
  );

  function handleCreateSiblingGroup(selectedPersonId: string | null) {
    if (!selectedPersonId) return;
    mutations.siblingGroups.create.mutate(
      { personIds: [selectedPersonId], data: { members: [] } },
      {
        onSuccess: (response) => {
          dispatchCanvas({
            type: "SET_OPEN_SIBLING_GROUP",
            id: (response as { id: string }).id,
          });
        },
      },
    );
  }

  function handleSaveSiblingGroup(
    groupId: string,
    members: SiblingGroupMember[],
    personIds: string[],
  ) {
    const group = siblingGroups.get(groupId);
    siblingGroupHandlers.save(groupId, { members, position: group?.position }, personIds);
    dispatchCanvas({ type: "SET_OPEN_SIBLING_GROUP", id: null });
  }

  function handleDeleteSiblingGroup(groupId: string) {
    siblingGroupHandlers.remove(groupId);
    dispatchCanvas({ type: "SET_OPEN_SIBLING_GROUP", id: null });
  }

  function handlePromoteMember(groupId: string, memberIndex: number) {
    const group = siblingGroups.get(groupId);
    if (!group) return;
    promoteMember.mutate(
      { group, memberIndex },
      {
        onSuccess: () => dispatchCanvas({ type: "SET_OPEN_SIBLING_GROUP", id: null }),
      },
    );
  }

  function handleSaveRelationship(relationshipId: string, data: RelationshipData) {
    mutations.updateRelationship.mutate({ relationshipId, data });
  }

  function handleDeleteRelationship(relationshipId: string) {
    mutations.deleteRelationship.mutate(relationshipId, {
      onSuccess: () => dispatchCanvas({ type: "SELECT_EDGE", id: null }),
    });
  }

  return {
    handleNodeDragStart,
    handleNodeDragStop,
    handleAddPerson,
    handleAutoLayout,
    handleUndo,
    applyPositions,
    selectedPersonSiblingGroup,
    handleCreateSiblingGroup,
    handleSaveSiblingGroup,
    handleDeleteSiblingGroup,
    handlePromoteMember,
    handleSaveRelationship,
    handleDeleteRelationship,
    hasPinnedNodes: Array.from(persons.values()).some((p) => p.position),
  };
}

function CanvasContent({
  animatingLayout,
  nodes,
  edges,
  onNodesChange,
  onNodeClick,
  onNodeDragStart,
  onNodeDragStop,
  onPaneClick,
  onEdgeClick,
  onConnect,
  canvasSettings,
  patterns,
  effectiveVisiblePatternIds,
  onPatternClick,
  showReflectionPrompts,
  journalPanelOpen,
  personsSize,
  onAddPerson,
  openJournal,
  isLoading,
}: {
  animatingLayout: boolean;
  nodes: AnyNodeType[];
  edges: RelationshipEdgeType[];
  onNodesChange: OnNodesChange<AnyNodeType>;
  onNodeClick: (event: React.MouseEvent, node: AnyNodeType) => void;
  onNodeDragStart: (event: React.MouseEvent, node: AnyNodeType) => void;
  onNodeDragStop: (event: React.MouseEvent, node: AnyNodeType) => void;
  onPaneClick: () => void;
  onEdgeClick: (event: React.MouseEvent, edge: RelationshipEdgeType) => void;
  onConnect: OnConnect;
  canvasSettings: ReturnType<typeof useCanvasSettings>["settings"];
  patterns: ReturnType<typeof useTreeData>["patterns"];
  effectiveVisiblePatternIds: Set<string>;
  onPatternClick: () => void;
  showReflectionPrompts: boolean;
  journalPanelOpen: boolean;
  personsSize: number;
  onAddPerson: () => void;
  openJournal: (prompt: string) => void;
  isLoading: boolean;
}) {
  return (
    <>
      <ReactFlow
        className={animatingLayout ? "layout-animating" : undefined}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        onConnect={onConnect}
        snapToGrid={canvasSettings.snapToGrid}
        snapGrid={[20, 20]}
        nodeDragThreshold={5}
        fitView
        deleteKeyCode={null}
        proOptions={{ hideAttribution: true }}
      >
        {canvasSettings.showGrid && <Background gap={20} />}
        {canvasSettings.showMinimap && <MiniMap />}
        <Controls showInteractive={false} />
      </ReactFlow>
      <PatternConnectors
        patterns={patterns}
        visiblePatternIds={effectiveVisiblePatternIds}
        onPatternClick={onPatternClick}
      />
      {showReflectionPrompts && !journalPanelOpen && personsSize > 0 && (
        <ReflectionNudge onOpenJournal={(prompt) => openJournal(prompt)} />
      )}
      {!isLoading && personsSize === 0 && <EmptyCanvasState onAddPerson={onAddPerson} />}
    </>
  );
}

function RelationshipPromptOverlay({
  personId,
  selectedPersonId,
  selectedEdgeId,
  persons,
  mutations,
  dispatchCanvas,
}: {
  personId: string;
  selectedPersonId: string | null;
  selectedEdgeId: string | null;
  persons: Map<string, DecryptedPerson>;
  mutations: ReturnType<typeof useTreeMutations>;
  dispatchCanvas: React.Dispatch<CanvasInteractionAction>;
}) {
  const person = persons.get(personId);
  if (selectedPersonId || selectedEdgeId || !person) return null;
  return (
    <RelationshipPrompt
      person={person}
      allPersons={persons}
      onCreateRelationship={(sourceId, targetId, type) => {
        mutations.createRelationship.mutate(
          {
            sourcePersonId: sourceId,
            targetPersonId: targetId,
            data: { type, periods: [], active_period: null },
          },
          {
            onSuccess: () => dispatchCanvas({ type: "SET_RELATIONSHIP_PROMPT", personId: null }),
          },
        );
      }}
      onDismiss={() => dispatchCanvas({ type: "SET_RELATIONSHIP_PROMPT", personId: null })}
    />
  );
}

function useCanvasEventHandlers(opts: {
  selectedPersonId: string | null;
  setSelectedPersonId: (id: string | null) => void;
  panels: {
    setPatternPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
    setJournalPanelOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
    setInitialSection: (section: PersonDetailSection) => void;
  };
  dispatchCanvas: React.Dispatch<CanvasInteractionAction>;
  canvasState: CanvasInteractionState;
  relationships: Map<string, { source_person_id: string; target_person_id: string }>;
  mutations: ReturnType<typeof useTreeMutations>;
}) {
  const {
    selectedPersonId,
    setSelectedPersonId,
    panels,
    dispatchCanvas,
    canvasState,
    relationships,
    mutations,
  } = opts;

  const dismissAll = useCallback(() => {
    setSelectedPersonId(null);
    dispatchCanvas({ type: "DISMISS_ALL" });
    panels.setPatternPanelOpen(false);
    panels.setJournalPanelOpen(false);
  }, [setSelectedPersonId, panels, dispatchCanvas]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        dismissAll();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dismissAll]);

  useEffect(() => {
    if (
      canvasState.relationshipPromptPersonId &&
      selectedPersonId &&
      selectedPersonId !== canvasState.relationshipPromptPersonId
    ) {
      dispatchCanvas({ type: "SET_RELATIONSHIP_PROMPT", personId: null });
    }
  }, [selectedPersonId, canvasState.relationshipPromptPersonId, dispatchCanvas]);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: AnyNodeType) => {
      if (node.type === "siblingGroup") {
        dispatchCanvas({
          type: "SET_OPEN_SIBLING_GROUP",
          id: node.id.replace("sibling-group-", ""),
        });
        return;
      }

      const badge = (event.target as HTMLElement).closest(
        "[data-badge-type]",
      ) as HTMLElement | null;
      setSelectedPersonId(node.id);
      panels.setPatternPanelOpen(false);
      if (badge) {
        panels.setInitialSection(badge.dataset.badgeType as PersonDetailSection);
        dispatchCanvas({ type: "NODE_CLICKED", entityId: badge.dataset.badgeId! });
      } else {
        panels.setInitialSection(null);
        dispatchCanvas({ type: "NODE_CLICKED", entityId: null });
      }
    },
    [setSelectedPersonId, panels, dispatchCanvas],
  );

  const onPaneClick = useCallback(() => {
    setSelectedPersonId(null);
    dispatchCanvas({ type: "SELECT_EDGE", id: null });
  }, [setSelectedPersonId, dispatchCanvas]);

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: RelationshipEdgeType) => {
      dispatchCanvas({ type: "SELECT_EDGE", id: edge.id });
      setSelectedPersonId(null);
    },
    [setSelectedPersonId, dispatchCanvas],
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (connection.source === connection.target) return;
      for (const rel of relationships.values()) {
        if (
          (rel.source_person_id === connection.source &&
            rel.target_person_id === connection.target) ||
          (rel.source_person_id === connection.target && rel.target_person_id === connection.source)
        ) {
          return;
        }
      }
      dispatchCanvas({ type: "SET_PENDING_CONNECTION", connection });
    },
    [relationships, dispatchCanvas],
  );

  const handleCreateRelationship = useCallback(
    (type: RelationshipType) => {
      if (!canvasState.pendingConnection) return;
      mutations.createRelationship.mutate(
        {
          sourcePersonId: canvasState.pendingConnection.source!,
          targetPersonId: canvasState.pendingConnection.target!,
          data: { type, periods: [], active_period: null },
        },
        {
          onSuccess: () => dispatchCanvas({ type: "SET_PENDING_CONNECTION", connection: null }),
        },
      );
    },
    [canvasState.pendingConnection, mutations.createRelationship, dispatchCanvas],
  );

  return {
    onNodeClick,
    onPaneClick,
    onEdgeClick,
    onConnect,
    handleCreateRelationship,
  };
}

/* -- Main inner component -------------------------------------------------- */

function TreeWorkspaceInner() {
  const treeId = useTreeId();
  const { t } = useTranslation();
  const { fitView, screenToFlowPosition } = useReactFlow();
  const location = useLocation();
  const openPatternId = (location.state as { openPatternId?: string } | null)?.openPatternId;

  const panels = useWorkspacePanels({
    initialPatternPanelOpen: !!openPatternId,
  });
  const { selectedPersonId, setSelectedPersonId } = panels;
  const [canvasState, dispatchCanvas] = useReducer(
    canvasInteractionReducer,
    canvasInteractionInitialState,
  );
  const [visiblePatternIds, setVisiblePatternIds] = useState<Set<string>>(
    openPatternId ? new Set([openPatternId]) : new Set(),
  );

  const effectiveVisiblePatternIds = useMemo(() => {
    if (!panels.hoveredPatternId || visiblePatternIds.has(panels.hoveredPatternId))
      return visiblePatternIds;
    return new Set([...visiblePatternIds, panels.hoveredPatternId]);
  }, [visiblePatternIds, panels.hoveredPatternId]);

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
    siblingGroups,
    isLoading,
    error,
  } = treeData;
  const mutations = useTreeMutations(treeId!);
  const { settings: canvasSettings, update: updateCanvasSettings } = useCanvasSettings();
  const { canUndo, push: pushPositionSnapshot, pop: popPositionSnapshot } = usePositionHistory();
  const { exportEncrypted, exportPlaintext } = useExportTree(treeId!, treeData);

  const canvasViewTab = useMemo(
    () => ({
      label: t("settings.canvas"),
      content: (
        <CanvasSettingsContent
          settings={canvasSettings}
          onUpdate={updateCanvasSettings}
          onExportEncrypted={exportEncrypted}
          onExportPlaintext={exportPlaintext}
        />
      ),
    }),
    [t, canvasSettings, updateCanvasSettings, exportEncrypted, exportPlaintext],
  );

  const layoutSettings = useMemo(
    () => ({
      edgeStyle: canvasSettings.edgeStyle,
      showMarkers: canvasSettings.showMarkers,
    }),
    [canvasSettings.edgeStyle, canvasSettings.showMarkers],
  );

  const { nodes: layoutNodes, edges: allEdges } = useTreeLayout(
    persons,
    relationships,
    events,
    selectedPersonId,
    lifeEvents,
    layoutSettings,
    classifications,
    turningPoints,
    siblingGroups,
  );

  const edges = useMemo(
    () =>
      filterEdgesByVisibility(allEdges, {
        showParentEdges: canvasSettings.showParentEdges,
        showPartnerEdges: canvasSettings.showPartnerEdges,
        showSiblingEdges: canvasSettings.showSiblingEdges,
        showFriendEdges: canvasSettings.showFriendEdges,
      }),
    [
      allEdges,
      canvasSettings.showParentEdges,
      canvasSettings.showPartnerEdges,
      canvasSettings.showSiblingEdges,
      canvasSettings.showFriendEdges,
    ],
  );

  const { nodes, onNodesChange, layoutRevisionRef } = useCanvasNodes(
    layoutNodes,
    edges.length,
    fitView,
  );

  const actions = useCanvasActions({
    treeId: treeId!,
    persons,
    siblingGroups,
    mutations,
    nodes,
    layoutRevisionRef,
    canvasSettings,
    dispatchCanvas,
    setSelectedPersonId,
    panels,
    screenToFlowPosition,
    pushPositionSnapshot,
    popPositionSnapshot,
  });

  const canvasEvents = useCanvasEventHandlers({
    selectedPersonId,
    setSelectedPersonId,
    panels,
    dispatchCanvas,
    canvasState,
    relationships,
    mutations,
  });

  const handlers = useLinkedEntityPanelHandlers({
    mutations,
    selectedPersonId,
    onPersonDeleted: () => setSelectedPersonId(null),
    onPersonSaved: () => setSelectedPersonId(null),
  });

  function handleTogglePatternVisibility(patternId: string) {
    setVisiblePatternIds((prev) => {
      const next = new Set(prev);
      if (next.has(patternId)) {
        next.delete(patternId);
      } else {
        next.add(patternId);
      }
      return next;
    });
  }

  const selectedEntities = useSelectedPersonEntities(
    selectedPersonId,
    relationships,
    events,
    lifeEvents,
    turningPoints,
    classifications,
  );

  const selectedRelationship = canvasState.selectedEdgeId
    ? (relationships.get(canvasState.selectedEdgeId) ?? null)
    : null;

  const openSiblingGroup = canvasState.openSiblingGroupId
    ? (siblingGroups.get(canvasState.openSiblingGroupId) ?? null)
    : null;

  const selectedPersonSibGroup = actions.selectedPersonSiblingGroup(selectedPersonId);

  if (error) {
    return (
      <div className="tree-workspace">
        <TreeToolbar
          treeId={treeId!}
          treeName={treeName}
          activeView="canvas"
          viewTab={canvasViewTab}
        />
        <div style={{ padding: 20 }}>{t("tree.decryptionError")}</div>
      </div>
    );
  }

  return (
    <div className="tree-workspace">
      <TreeToolbar treeId={treeId!} treeName={treeName} activeView="canvas" viewTab={canvasViewTab}>
        <CanvasToolbarButtons
          onAddPerson={actions.handleAddPerson}
          isAddingPerson={mutations.createPerson.isPending}
          onAutoLayout={actions.handleAutoLayout}
          hasLayout={actions.hasPinnedNodes}
          onUndo={actions.handleUndo}
          canUndo={canUndo}
          patternPanelOpen={panels.patternPanelOpen}
          onTogglePatterns={() => panels.setPatternPanelOpen((v) => !v)}
          journalPanelOpen={panels.journalPanelOpen}
          onToggleJournal={() => panels.setJournalPanelOpen((v) => !v)}
        />
      </TreeToolbar>

      <div className="tree-canvas-wrapper bg-gradient">
        {!canvasSettings.showGrid && <BranchDecoration />}
        {isLoading ? (
          <div style={{ padding: 20 }}>{t("common.loading")}</div>
        ) : (
          <CanvasContent
            animatingLayout={canvasState.animatingLayout}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onNodeClick={canvasEvents.onNodeClick}
            onNodeDragStart={actions.handleNodeDragStart}
            onNodeDragStop={actions.handleNodeDragStop}
            onPaneClick={canvasEvents.onPaneClick}
            onEdgeClick={canvasEvents.onEdgeClick}
            onConnect={canvasEvents.onConnect}
            canvasSettings={canvasSettings}
            patterns={patterns}
            effectiveVisiblePatternIds={effectiveVisiblePatternIds}
            onPatternClick={() => panels.setPatternPanelOpen(true)}
            showReflectionPrompts={canvasSettings.showReflectionPrompts}
            journalPanelOpen={panels.journalPanelOpen}
            personsSize={persons.size}
            onAddPerson={actions.handleAddPerson}
            openJournal={(prompt) => panels.openJournal(prompt)}
            isLoading={isLoading}
          />
        )}

        {selectedRelationship && (
          <RelationshipDetailPanel
            relationship={selectedRelationship}
            allPersons={persons}
            onSaveRelationship={actions.handleSaveRelationship}
            onDeleteRelationship={actions.handleDeleteRelationship}
            onClose={() => dispatchCanvas({ type: "SELECT_EDGE", id: null })}
          />
        )}

        <WorkspacePanelHost
          panels={panels}
          handlers={handlers}
          entities={selectedEntities}
          treeData={treeData}
          visiblePatternIds={visiblePatternIds}
          onTogglePatternVisibility={handleTogglePatternVisibility}
          initialExpandedPatternId={openPatternId}
          initialEntityId={canvasState.initialEntityId ?? undefined}
          showReflectionPrompts={canvasSettings.showReflectionPrompts}
          siblingGroup={selectedPersonSibGroup}
          onCreateSiblingGroup={() => actions.handleCreateSiblingGroup(selectedPersonId)}
          onOpenSiblingGroup={(groupId) =>
            dispatchCanvas({ type: "SET_OPEN_SIBLING_GROUP", id: groupId })
          }
        />

        {openSiblingGroup && (
          <SiblingGroupPanel
            group={openSiblingGroup}
            allPersons={persons}
            onSave={actions.handleSaveSiblingGroup}
            onDelete={actions.handleDeleteSiblingGroup}
            onPromote={actions.handlePromoteMember}
            onClose={() => dispatchCanvas({ type: "SET_OPEN_SIBLING_GROUP", id: null })}
          />
        )}
      </div>

      {canvasState.pendingConnection && (
        <RelationshipPopover
          connection={canvasState.pendingConnection}
          persons={persons}
          onSelect={canvasEvents.handleCreateRelationship}
          onSwap={() => dispatchCanvas({ type: "SWAP_PENDING_CONNECTION" })}
          onClose={() => dispatchCanvas({ type: "SET_PENDING_CONNECTION", connection: null })}
        />
      )}

      {canvasState.relationshipPromptPersonId && (
        <RelationshipPromptOverlay
          personId={canvasState.relationshipPromptPersonId}
          selectedPersonId={selectedPersonId}
          selectedEdgeId={canvasState.selectedEdgeId}
          persons={persons}
          mutations={mutations}
          dispatchCanvas={dispatchCanvas}
        />
      )}
    </div>
  );
}

export default function TreeWorkspacePage() {
  return (
    <ReactFlowProvider>
      <TreeWorkspaceInner />
    </ReactFlowProvider>
  );
}
