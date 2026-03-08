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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { BranchDecoration } from "../components/BranchDecoration";
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

function TreeWorkspaceInner() {
  const treeId = useTreeId();
  const { t } = useTranslation();
  const { fitView, screenToFlowPosition } = useReactFlow();
  const queryClient = useQueryClient();
  const location = useLocation();
  const openPatternId = (location.state as { openPatternId?: string } | null)?.openPatternId;

  const panels = useWorkspacePanels({
    initialPatternPanelOpen: !!openPatternId,
  });
  const { selectedPersonId, setSelectedPersonId } = panels;
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [visiblePatternIds, setVisiblePatternIds] = useState<Set<string>>(
    openPatternId ? new Set([openPatternId]) : new Set(),
  );
  const [relationshipPromptPersonId, setRelationshipPromptPersonId] = useState<string | null>(null);
  const [initialEntityId, setInitialEntityId] = useState<string | null>(null);

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
  const [animatingLayout, setAnimatingLayout] = useState(false);
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

  type AnyNodeType = PersonNodeType | SiblingGroupNodeType;

  // Local node state that accepts both layout updates and drag changes
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
    const edgesChanged = edges.length !== prevEdgeCountRef.current;
    const layoutRevisionChanged = layoutRevisionRef.current !== prevLayoutRevisionRef.current;
    const structureChanged = nodesChanged || edgesChanged || layoutRevisionChanged;
    prevNodeIdsRef.current = currentIds;
    prevEdgeCountRef.current = edges.length;
    prevLayoutRevisionRef.current = layoutRevisionRef.current;

    setNodes((prev) => {
      const prevMap = new Map(prev.map((n) => [n.id, n]));
      return layoutNodes.map((n) => {
        const existing = prevMap.get(n.id);
        if (!existing) return n;
        if (structureChanged) {
          // Structure changed (add/delete/relationship): accept new positions
          return { ...n, measured: existing.measured };
        }
        // Data-only change (save/close): keep current positions
        return { ...n, position: existing.position, measured: existing.measured };
      });
    });
  }, [layoutNodes, edges.length]);

  const onNodesChange: OnNodesChange<AnyNodeType> = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // Fit view only when node count actually changes
  useEffect(() => {
    if (layoutNodes.length > 0 && layoutNodes.length !== prevNodeCountRef.current) {
      prevNodeCountRef.current = layoutNodes.length;
      const timer = setTimeout(() => fitView({ padding: 0.2 }), 50);
      return () => clearTimeout(timer);
    }
  }, [layoutNodes.length, fitView]);

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedPersonId(null);
        setSelectedEdgeId(null);
        setPendingConnection(null);
        panels.setPatternPanelOpen(false);
        panels.setJournalPanelOpen(false);
        setRelationshipPromptPersonId(null);
        setOpenSiblingGroupId(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setSelectedPersonId, panels]);

  // Auto-dismiss relationship prompt when user selects a different person
  useEffect(() => {
    if (
      relationshipPromptPersonId &&
      selectedPersonId &&
      selectedPersonId !== relationshipPromptPersonId
    ) {
      setRelationshipPromptPersonId(null);
    }
  }, [selectedPersonId, relationshipPromptPersonId]);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: AnyNodeType) => {
      // Sibling group nodes are not selectable as persons
      if (node.type === "siblingGroup") return;

      const badge = (event.target as HTMLElement).closest(
        "[data-badge-type]",
      ) as HTMLElement | null;
      setSelectedPersonId(node.id);
      setSelectedEdgeId(null);
      panels.setPatternPanelOpen(false);
      if (badge) {
        panels.setInitialSection(badge.dataset.badgeType as PersonDetailSection);
        setInitialEntityId(badge.dataset.badgeId!);
      } else {
        panels.setInitialSection(null);
        setInitialEntityId(null);
      }
    },
    [setSelectedPersonId, panels],
  );

  const onPaneClick = useCallback(() => {
    setSelectedPersonId(null);
    setSelectedEdgeId(null);
  }, [setSelectedPersonId]);

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: RelationshipEdgeType) => {
      setSelectedEdgeId(edge.id);
      setSelectedPersonId(null);
    },
    [setSelectedPersonId],
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (connection.source === connection.target) return;
      // Check for duplicate
      for (const rel of relationships.values()) {
        if (
          (rel.source_person_id === connection.source &&
            rel.target_person_id === connection.target) ||
          (rel.source_person_id === connection.target && rel.target_person_id === connection.source)
        ) {
          return;
        }
      }
      setPendingConnection(connection);
    },
    [relationships],
  );

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
      if (node.type === "siblingGroup") return;
      const person = persons.get(node.id);
      if (!person) return;

      const position = { x: node.position.x, y: node.position.y };

      // Optimistic cache update -- layout recomputes immediately with pinned position
      queryClient.setQueryData(
        treeQueryKeys.persons(treeId!),
        (old: Map<string, DecryptedPerson> | undefined) => {
          if (!old) return old;
          const next = new Map(old);
          next.set(node.id, { ...person, position });
          return next;
        },
      );

      // Persist
      const { id, ...data } = person;
      mutations.updatePerson.mutate({ personId: id, data: { ...data, position } });
    },
    [persons, queryClient, treeId, mutations.updatePerson],
  );

  function handleAddPerson() {
    // Place new node in the visible area, offset left to leave room for the detail panel
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
      gender: "other",
      is_adopted: false,
      notes: null,
      position,
    };
    mutations.createPerson.mutate(newPerson, {
      onSuccess: (response) => {
        setSelectedPersonId(response.id);
        panels.setPatternPanelOpen(false);
        if (canvasSettings.promptRelationship && persons.size > 0) {
          setRelationshipPromptPersonId(response.id);
        }
      },
    });
  }

  function handleCreateRelationship(type: RelationshipType) {
    if (!pendingConnection) return;
    mutations.createRelationship.mutate(
      {
        sourcePersonId: pendingConnection.source!,
        targetPersonId: pendingConnection.target!,
        data: {
          type,
          periods: [],
          active_period: null,
        },
      },
      {
        onSuccess: () => setPendingConnection(null),
      },
    );
  }

  const handlers = useLinkedEntityPanelHandlers({
    mutations,
    selectedPersonId,
    onPersonDeleted: () => setSelectedPersonId(null),
    onPersonSaved: () => setSelectedPersonId(null),
  });

  // --- Sibling group panel state and handlers ---
  const [openSiblingGroupId, setOpenSiblingGroupId] = useState<string | null>(null);
  const promoteMember = usePromoteMember(treeId!);

  const siblingGroupHandlers = useMemo(
    () => linkedEntityHandlers(mutations.siblingGroups),
    [mutations.siblingGroups],
  );

  const selectedPersonSiblingGroup = useMemo(() => {
    if (!selectedPersonId) return null;
    const groups = filterByPerson(siblingGroups, selectedPersonId);
    return groups.length > 0 ? groups[0] : null;
  }, [selectedPersonId, siblingGroups]);

  const openSiblingGroup = openSiblingGroupId
    ? (siblingGroups.get(openSiblingGroupId) ?? null)
    : null;

  function handleCreateSiblingGroup() {
    if (!selectedPersonId) return;
    mutations.siblingGroups.create.mutate(
      { personIds: [selectedPersonId], data: { members: [] } },
      {
        onSuccess: (response) => {
          setOpenSiblingGroupId((response as { id: string }).id);
        },
      },
    );
  }

  function handleOpenSiblingGroup(groupId: string) {
    setOpenSiblingGroupId(groupId);
  }

  function handleSaveSiblingGroup(
    groupId: string,
    members: SiblingGroupMember[],
    personIds: string[],
  ) {
    siblingGroupHandlers.save(groupId, { members }, personIds);
  }

  function handleDeleteSiblingGroup(groupId: string) {
    siblingGroupHandlers.remove(groupId);
    setOpenSiblingGroupId(null);
  }

  function handlePromoteMember(groupId: string, memberIndex: number) {
    const group = siblingGroups.get(groupId);
    if (!group) return;
    promoteMember.mutate({ group, memberIndex }, { onSuccess: () => setOpenSiblingGroupId(null) });
  }

  function handleSaveRelationship(relationshipId: string, data: RelationshipData) {
    mutations.updateRelationship.mutate({ relationshipId, data });
  }

  function handleDeleteRelationship(relationshipId: string) {
    mutations.deleteRelationship.mutate(relationshipId, {
      onSuccess: () => setSelectedEdgeId(null),
    });
  }

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

  const hasPinnedNodes = Array.from(persons.values()).some((p) => p.position);

  // Shared helper: apply a position map with animation, optimistic cache update, and persistence
  const applyPositions = useCallback(
    (positionMap: PositionSnapshot) => {
      layoutRevisionRef.current += 1;

      setAnimatingLayout(true);
      setTimeout(() => setAnimatingLayout(false), 350);

      queryClient.setQueryData(
        treeQueryKeys.persons(treeId!),
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
    [queryClient, treeId, persons, mutations.batchUpdatePersons],
  );

  function handleAutoLayout() {
    const pinnedPersons = Array.from(persons.values()).filter((p) => p.position);
    if (pinnedPersons.length === 0) return;

    // Save current positions for undo
    const snapshot: PositionSnapshot = new Map();
    for (const p of persons.values()) {
      snapshot.set(p.id, p.position);
    }
    pushPositionSnapshot(snapshot);

    // Clear all pinned positions
    const clearMap: PositionSnapshot = new Map(pinnedPersons.map((p) => [p.id, undefined]));
    applyPositions(clearMap);
  }

  const handleUndo = useCallback(() => {
    const snapshot = popPositionSnapshot();
    if (!snapshot) return;
    applyPositions(snapshot);
  }, [popPositionSnapshot, applyPositions]);

  // Keyboard shortcut: Cmd/Ctrl+Z for undo
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

  const selectedEntities = useSelectedPersonEntities(
    selectedPersonId,
    relationships,
    events,
    lifeEvents,
    turningPoints,
    classifications,
  );

  const selectedRelationship = selectedEdgeId ? (relationships.get(selectedEdgeId) ?? null) : null;

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
          onAddPerson={handleAddPerson}
          isAddingPerson={mutations.createPerson.isPending}
          onAutoLayout={handleAutoLayout}
          hasLayout={hasPinnedNodes}
          onUndo={handleUndo}
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
          <>
            <ReactFlow
              className={animatingLayout ? "layout-animating" : undefined}
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onNodeClick={onNodeClick}
              onNodeDragStart={handleNodeDragStart}
              onNodeDragStop={handleNodeDragStop}
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
              onPatternClick={() => panels.setPatternPanelOpen(true)}
            />
            {canvasSettings.showReflectionPrompts &&
              !panels.journalPanelOpen &&
              persons.size > 0 && (
                <ReflectionNudge onOpenJournal={(prompt) => panels.openJournal(prompt)} />
              )}
            {!isLoading && persons.size === 0 && (
              <div className="tree-canvas-empty">
                <TreePine size={32} strokeWidth={1.5} color="var(--color-text-muted)" />
                <h2 className="tree-canvas-empty__title">{t("tree.canvasEmpty")}</h2>
                <p className="tree-canvas-empty__hint">{t("tree.canvasEmptyHint")}</p>
                <button type="button" className="tree-canvas-empty__btn" onClick={handleAddPerson}>
                  <UserPlus size={16} />
                  {t("tree.addPerson")}
                </button>
              </div>
            )}
          </>
        )}

        {selectedRelationship && (
          <RelationshipDetailPanel
            relationship={selectedRelationship}
            allPersons={persons}
            onSaveRelationship={handleSaveRelationship}
            onDeleteRelationship={handleDeleteRelationship}
            onClose={() => setSelectedEdgeId(null)}
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
          initialEntityId={initialEntityId ?? undefined}
          showReflectionPrompts={canvasSettings.showReflectionPrompts}
          siblingGroup={selectedPersonSiblingGroup}
          onCreateSiblingGroup={handleCreateSiblingGroup}
          onOpenSiblingGroup={handleOpenSiblingGroup}
        />

        {openSiblingGroup && (
          <SiblingGroupPanel
            group={openSiblingGroup}
            onSave={handleSaveSiblingGroup}
            onDelete={handleDeleteSiblingGroup}
            onPromote={handlePromoteMember}
            onClose={() => setOpenSiblingGroupId(null)}
          />
        )}
      </div>

      {pendingConnection && (
        <RelationshipPopover
          connection={pendingConnection}
          persons={persons}
          onSelect={handleCreateRelationship}
          onSwap={() =>
            setPendingConnection({
              ...pendingConnection,
              source: pendingConnection.target,
              target: pendingConnection.source,
            })
          }
          onClose={() => setPendingConnection(null)}
        />
      )}

      {relationshipPromptPersonId &&
        !selectedPersonId &&
        !selectedEdgeId &&
        persons.get(relationshipPromptPersonId) && (
          <RelationshipPrompt
            person={persons.get(relationshipPromptPersonId)!}
            allPersons={persons}
            onCreateRelationship={(sourceId, targetId, type) => {
              mutations.createRelationship.mutate(
                {
                  sourcePersonId: sourceId,
                  targetPersonId: targetId,
                  data: { type, periods: [], active_period: null },
                },
                { onSuccess: () => setRelationshipPromptPersonId(null) },
              );
            }}
            onDismiss={() => setRelationshipPromptPersonId(null)}
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
