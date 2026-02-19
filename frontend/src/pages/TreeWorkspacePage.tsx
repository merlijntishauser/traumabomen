import { useQueryClient } from "@tanstack/react-query";
import {
  applyNodeChanges,
  Background,
  type Connection,
  MiniMap,
  type OnConnect,
  type OnNodesChange,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { LayoutGrid, TreePine, UserPlus, Waypoints } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { BranchDecoration } from "../components/BranchDecoration";
import { CanvasSettingsContent } from "../components/tree/CanvasSettingsContent";
import { PatternConnectors } from "../components/tree/PatternConnectors";
import { PatternPanel } from "../components/tree/PatternPanel";
import { PersonDetailPanel } from "../components/tree/PersonDetailPanel";
import { PersonNode } from "../components/tree/PersonNode";
import { RelationshipDetailPanel } from "../components/tree/RelationshipDetailPanel";
import { RelationshipEdge } from "../components/tree/RelationshipEdge";
import { TreeToolbar } from "../components/tree/TreeToolbar";
import { useCanvasSettings } from "../hooks/useCanvasSettings";
import type { DecryptedPerson } from "../hooks/useTreeData";
import { treeQueryKeys, useTreeData } from "../hooks/useTreeData";
import { useTreeId } from "../hooks/useTreeId";
import type { PersonNodeType, RelationshipEdgeType } from "../hooks/useTreeLayout";
import { useTreeLayout } from "../hooks/useTreeLayout";
import { useTreeMutations } from "../hooks/useTreeMutations";
import { inferSiblings } from "../lib/inferSiblings";
import type {
  Classification,
  LifeEvent,
  Pattern,
  Person,
  RelationshipData,
  TraumaEvent,
} from "../types/domain";
import { RelationshipType } from "../types/domain";
import "../components/tree/TreeCanvas.css";

const nodeTypes = { person: PersonNode };
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

const T_COMMON_CANCEL = "common.cancel";

const DIRECTIONAL_TYPES = new Set([
  RelationshipType.BiologicalParent,
  RelationshipType.StepParent,
  RelationshipType.AdoptiveParent,
]);

function RelationshipPopover({
  connection,
  persons,
  onSelect,
  onSwap,
  onClose,
}: {
  connection: Connection;
  persons: Map<string, DecryptedPerson>;
  onSelect: (type: RelationshipType) => void;
  onSwap: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const sourceName = persons.get(connection.source!)?.name ?? "?";
  const targetName = persons.get(connection.target!)?.name ?? "?";

  return (
    <div className="relationship-popover" onClick={onClose}>
      <div className="relationship-popover__card" onClick={(e) => e.stopPropagation()}>
        <h3>{t("relationship.selectType")}</h3>
        <div className="relationship-popover__direction">
          <span>
            {sourceName} &rarr; {targetName}
          </span>
          <button type="button" className="relationship-popover__swap" onClick={onSwap}>
            {t("relationship.swap")}
          </button>
        </div>
        <div className="relationship-popover__options">
          {Object.values(RelationshipType).map((type) => (
            <button
              type="button"
              key={type}
              className="relationship-popover__option"
              onClick={() => onSelect(type)}
            >
              {DIRECTIONAL_TYPES.has(type)
                ? t("relationship.directionLabel", {
                    source: sourceName,
                    type: t(`relationship.type.${type}`).toLowerCase(),
                    target: targetName,
                  })
                : t(`relationship.type.${type}`)}
            </button>
          ))}
        </div>
        <button type="button" className="relationship-popover__cancel" onClick={onClose}>
          {t(T_COMMON_CANCEL)}
        </button>
      </div>
    </div>
  );
}

function RelationshipPrompt({
  person,
  allPersons,
  onCreateRelationship,
  onDismiss,
}: {
  person: DecryptedPerson;
  allPersons: Map<string, DecryptedPerson>;
  onCreateRelationship: (sourceId: string, targetId: string, type: RelationshipType) => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"ask" | "pickPerson" | "pickType">("ask");
  const [targetPersonId, setTargetPersonId] = useState<string | null>(null);
  const [swapped, setSwapped] = useState(false);

  const targetPerson = targetPersonId ? allPersons.get(targetPersonId) : null;

  // Smart default: older person is source for parent types
  const personYear = person.birth_year;
  const targetYear = targetPerson?.birth_year;
  const defaultSourceIsNew =
    personYear != null && targetYear != null ? personYear < targetYear : true;
  const sourceIsNew = swapped ? !defaultSourceIsNew : defaultSourceIsNew;

  const sourceId = sourceIsNew ? person.id : (targetPersonId ?? "");
  const targetId = sourceIsNew ? (targetPersonId ?? "") : person.id;
  const sourceName = sourceIsNew ? person.name : (targetPerson?.name ?? "");
  const targetName = sourceIsNew ? (targetPerson?.name ?? "") : person.name;

  const otherPersons = Array.from(allPersons.entries()).filter(([id]) => id !== person.id);

  function formatPersonLabel(p: DecryptedPerson) {
    return p.birth_year ? `${p.name} (${p.birth_year})` : p.name;
  }

  if (step === "ask") {
    return (
      <div className="relationship-prompt">
        <div className="relationship-prompt__card">
          <p className="relationship-prompt__text">
            {t("relationship.promptConnect", { name: person.name })}
          </p>
          <div className="relationship-prompt__actions">
            <button
              type="button"
              className="relationship-prompt__btn relationship-prompt__btn--primary"
              onClick={() => setStep("pickPerson")}
            >
              {t("common.yes")}
            </button>
            <button type="button" className="relationship-prompt__btn" onClick={onDismiss}>
              {t("common.no")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "pickPerson") {
    return (
      <div className="relationship-prompt">
        <div className="relationship-prompt__card relationship-prompt__card--expanded">
          <div className="relationship-prompt__header">
            <p className="relationship-prompt__text">
              {t("relationship.promptConnectTo", { name: person.name })}
            </p>
            <button type="button" className="relationship-prompt__btn" onClick={onDismiss}>
              {t(T_COMMON_CANCEL)}
            </button>
          </div>
          <div className="relationship-prompt__list">
            {otherPersons.map(([id, p]) => (
              <button
                type="button"
                key={id}
                className="relationship-prompt__item"
                onClick={() => {
                  setTargetPersonId(id);
                  setSwapped(false);
                  setStep("pickType");
                }}
              >
                {formatPersonLabel(p)}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // pickType step
  return (
    <div className="relationship-prompt">
      <div className="relationship-prompt__card relationship-prompt__card--expanded">
        <div className="relationship-prompt__header">
          <div className="relationship-prompt__direction">
            <span>
              {sourceName} &rarr; {targetName}
            </span>
            <button
              type="button"
              className="relationship-prompt__swap"
              onClick={() => setSwapped((s) => !s)}
            >
              {t("relationship.swap")}
            </button>
          </div>
          <button type="button" className="relationship-prompt__btn" onClick={onDismiss}>
            {t(T_COMMON_CANCEL)}
          </button>
        </div>
        <div className="relationship-prompt__list">
          {Object.values(RelationshipType).map((type) => (
            <button
              type="button"
              key={type}
              className="relationship-prompt__item"
              onClick={() => onCreateRelationship(sourceId, targetId, type)}
            >
              {DIRECTIONAL_TYPES.has(type)
                ? t("relationship.directionLabel", {
                    source: sourceName,
                    type: t(`relationship.type.${type}`).toLowerCase(),
                    target: targetName,
                  })
                : t(`relationship.type.${type}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TreeWorkspaceInner() {
  const treeId = useTreeId();
  const { t } = useTranslation();
  const { fitView, screenToFlowPosition } = useReactFlow<PersonNodeType, RelationshipEdgeType>();
  const queryClient = useQueryClient();
  const location = useLocation();
  const openPatternId = (location.state as { openPatternId?: string } | null)?.openPatternId;

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [patternPanelOpen, setPatternPanelOpen] = useState(!!openPatternId);
  const [visiblePatternIds, setVisiblePatternIds] = useState<Set<string>>(
    openPatternId ? new Set([openPatternId]) : new Set(),
  );
  const [hoveredPatternId, setHoveredPatternId] = useState<string | null>(null);
  const [relationshipPromptPersonId, setRelationshipPromptPersonId] = useState<string | null>(null);

  const effectiveVisiblePatternIds = useMemo(() => {
    if (!hoveredPatternId || visiblePatternIds.has(hoveredPatternId)) return visiblePatternIds;
    return new Set([...visiblePatternIds, hoveredPatternId]);
  }, [visiblePatternIds, hoveredPatternId]);

  const {
    treeName,
    persons,
    relationships,
    events,
    lifeEvents,
    classifications,
    patterns,
    isLoading,
    error,
  } = useTreeData(treeId!);
  const mutations = useTreeMutations(treeId!);
  const { settings: canvasSettings, update: updateCanvasSettings } = useCanvasSettings();

  const canvasViewTab = useMemo(
    () => ({
      label: t("settings.canvas"),
      content: <CanvasSettingsContent settings={canvasSettings} onUpdate={updateCanvasSettings} />,
    }),
    [t, canvasSettings, updateCanvasSettings],
  );

  const layoutSettings = useMemo(
    () => ({ edgeStyle: canvasSettings.edgeStyle, showMarkers: canvasSettings.showMarkers }),
    [canvasSettings.edgeStyle, canvasSettings.showMarkers],
  );

  const { nodes: layoutNodes, edges } = useTreeLayout(
    persons,
    relationships,
    events,
    selectedPersonId,
    lifeEvents,
    layoutSettings,
    classifications,
  );

  // Local node state that accepts both layout updates and drag changes
  const [nodes, setNodes] = useState<PersonNodeType[]>([]);
  const prevNodeIdsRef = useRef("");
  const prevNodeCountRef = useRef(0);

  useEffect(() => {
    const currentIds = layoutNodes
      .map((n) => n.id)
      .sort()
      .join(",");
    const structureChanged = currentIds !== prevNodeIdsRef.current;
    prevNodeIdsRef.current = currentIds;

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
  }, [layoutNodes]);

  const onNodesChange: OnNodesChange<PersonNodeType> = useCallback((changes) => {
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
        setPatternPanelOpen(false);
        setRelationshipPromptPersonId(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  const onNodeClick = useCallback((_: React.MouseEvent, node: PersonNodeType) => {
    setSelectedPersonId(node.id);
    setSelectedEdgeId(null);
    setPatternPanelOpen(false);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedPersonId(null);
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: RelationshipEdgeType) => {
    setSelectedEdgeId(edge.id);
    setSelectedPersonId(null);
  }, []);

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

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: PersonNodeType) => {
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
      gender: "other",
      is_adopted: false,
      notes: null,
      position,
    };
    mutations.createPerson.mutate(newPerson, {
      onSuccess: (response) => {
        setSelectedPersonId(response.id);
        setPatternPanelOpen(false);
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

  function handleSavePerson(data: Person) {
    if (!selectedPersonId) return;
    mutations.updatePerson.mutate(
      { personId: selectedPersonId, data },
      { onSuccess: () => setSelectedPersonId(null) },
    );
  }

  function handleDeletePerson(personId: string) {
    mutations.deletePerson.mutate(personId, {
      onSuccess: () => setSelectedPersonId(null),
    });
  }

  function handleSaveRelationship(relationshipId: string, data: RelationshipData) {
    mutations.updateRelationship.mutate({ relationshipId, data });
  }

  function handleDeleteRelationship(relationshipId: string) {
    mutations.deleteRelationship.mutate(relationshipId, {
      onSuccess: () => setSelectedEdgeId(null),
    });
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

  function handleAutoLayout() {
    const pinnedPersons = Array.from(persons.values()).filter((p) => p.position);
    if (pinnedPersons.length === 0) return;

    // Optimistic: clear all positions in cache
    queryClient.setQueryData(
      treeQueryKeys.persons(treeId!),
      (old: Map<string, DecryptedPerson> | undefined) => {
        if (!old) return old;
        const next = new Map(old);
        for (const p of pinnedPersons) {
          const { position, ...rest } = p;
          next.set(p.id, rest as DecryptedPerson);
        }
        return next;
      },
    );

    // Persist each
    for (const p of pinnedPersons) {
      const { id, position, ...data } = p;
      mutations.updatePerson.mutate({ personId: id, data });
    }
  }

  const selectedPerson = selectedPersonId ? persons.get(selectedPersonId) : null;

  const selectedRelationship = selectedEdgeId ? (relationships.get(selectedEdgeId) ?? null) : null;

  const selectedRelationships = selectedPersonId
    ? Array.from(relationships.values()).filter(
        (r) => r.source_person_id === selectedPersonId || r.target_person_id === selectedPersonId,
      )
    : [];

  const selectedEvents = selectedPersonId
    ? Array.from(events.values()).filter((e) => e.person_ids.includes(selectedPersonId))
    : [];

  const selectedLifeEvents = selectedPersonId
    ? Array.from(lifeEvents.values()).filter((e) => e.person_ids.includes(selectedPersonId))
    : [];

  const selectedClassifications = selectedPersonId
    ? Array.from(classifications.values()).filter((c) => c.person_ids.includes(selectedPersonId))
    : [];

  const inferredSiblings = useMemo(() => inferSiblings(relationships), [relationships]);

  const selectedInferredSiblings = selectedPersonId
    ? inferredSiblings.filter(
        (s) => s.personAId === selectedPersonId || s.personBId === selectedPersonId,
      )
    : [];

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
        <button
          type="button"
          className="tree-toolbar__btn"
          onClick={handleAddPerson}
          disabled={mutations.createPerson.isPending}
        >
          <UserPlus size={14} />
          {t("tree.addPerson")}
        </button>
        <button
          type="button"
          className="tree-toolbar__btn"
          onClick={handleAutoLayout}
          disabled={!hasPinnedNodes}
        >
          <LayoutGrid size={14} />
          {t("tree.autoLayout")}
        </button>
        <button
          type="button"
          className="tree-toolbar__btn"
          onClick={() => setPatternPanelOpen((v) => !v)}
        >
          <Waypoints size={14} />
          {t("pattern.editPatterns")}
        </button>
      </TreeToolbar>

      <div className="tree-canvas-wrapper bg-gradient">
        <BranchDecoration />
        {isLoading ? (
          <div style={{ padding: 20 }}>{t("common.loading")}</div>
        ) : (
          <>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onNodeClick={onNodeClick}
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
            </ReactFlow>
            <PatternConnectors
              patterns={patterns}
              visiblePatternIds={effectiveVisiblePatternIds}
              onPatternClick={() => setPatternPanelOpen(true)}
            />
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

        {selectedPerson && (
          <PersonDetailPanel
            person={selectedPerson}
            relationships={selectedRelationships}
            inferredSiblings={selectedInferredSiblings}
            events={selectedEvents}
            lifeEvents={selectedLifeEvents}
            classifications={selectedClassifications}
            allPersons={persons}
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

        {selectedRelationship && (
          <RelationshipDetailPanel
            relationship={selectedRelationship}
            allPersons={persons}
            onSaveRelationship={handleSaveRelationship}
            onDeleteRelationship={handleDeleteRelationship}
            onClose={() => setSelectedEdgeId(null)}
          />
        )}

        {patternPanelOpen && (
          <PatternPanel
            patterns={patterns}
            events={events}
            lifeEvents={lifeEvents}
            classifications={classifications}
            persons={persons}
            visiblePatternIds={visiblePatternIds}
            onToggleVisibility={handleTogglePatternVisibility}
            onSave={handleSavePattern}
            onDelete={handleDeletePattern}
            onClose={() => setPatternPanelOpen(false)}
            onHoverPattern={setHoveredPatternId}
            initialExpandedId={openPatternId}
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
