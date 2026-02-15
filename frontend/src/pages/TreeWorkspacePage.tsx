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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "@xyflow/react/dist/style.css";
import { useTranslation } from "react-i18next";
import { BranchDecoration } from "../components/BranchDecoration";
import { PersonDetailPanel } from "../components/tree/PersonDetailPanel";
import { PersonNode } from "../components/tree/PersonNode";
import { RelationshipDetailPanel } from "../components/tree/RelationshipDetailPanel";
import { RelationshipEdge } from "../components/tree/RelationshipEdge";
import { SettingsPanel } from "../components/tree/SettingsPanel";
import { useCanvasSettings } from "../hooks/useCanvasSettings";
import { useLogout } from "../hooks/useLogout";
import type { DecryptedPerson } from "../hooks/useTreeData";
import { treeQueryKeys, useTreeData } from "../hooks/useTreeData";
import { useTreeId } from "../hooks/useTreeId";
import type { PersonNodeType, RelationshipEdgeType } from "../hooks/useTreeLayout";
import { useTreeLayout } from "../hooks/useTreeLayout";
import { useTreeMutations } from "../hooks/useTreeMutations";
import { uuidToCompact } from "../lib/compactId";
import { inferSiblings } from "../lib/inferSiblings";
import type {
  Classification,
  LifeEvent,
  Person,
  RelationshipData,
  TraumaEvent,
} from "../types/domain";
import { RelationshipType } from "../types/domain";
import "../components/tree/TreeCanvas.css";

const nodeTypes = { person: PersonNode };
const edgeTypes = { relationship: RelationshipEdge };

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
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}

function TreeWorkspaceInner() {
  const treeId = useTreeId();
  const { t } = useTranslation();
  const logout = useLogout();
  const { fitView, setCenter, getZoom } = useReactFlow<PersonNodeType, RelationshipEdgeType>();
  const queryClient = useQueryClient();

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);

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
  const { settings: canvasSettings, update: updateCanvasSettings } = useCanvasSettings();

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
  const newlyCreatedNodeRef = useRef<string | null>(null);

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

  // Fit view when node count changes, or center on newly created node
  useEffect(() => {
    if (layoutNodes.length > 0 && layoutNodes.length !== prevNodeCountRef.current) {
      prevNodeCountRef.current = layoutNodes.length;

      const newNodeId = newlyCreatedNodeRef.current;
      if (newNodeId) {
        newlyCreatedNodeRef.current = null;
        const newNode = layoutNodes.find((n) => n.id === newNodeId);
        if (newNode) {
          // Center on new node, offset right to account for 400px detail panel
          const timer = setTimeout(() => {
            const zoom = getZoom();
            const panelOffset = 200 / zoom;
            setCenter(newNode.position.x + 90 + panelOffset, newNode.position.y + 40, {
              zoom,
              duration: 300,
            });
          }, 50);
          return () => clearTimeout(timer);
        }
      }

      const timer = setTimeout(() => fitView({ padding: 0.2 }), 50);
      return () => clearTimeout(timer);
    }
  }, [layoutNodes, fitView, setCenter, getZoom]);

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedPersonId(null);
        setSelectedEdgeId(null);
        setPendingConnection(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: PersonNodeType) => {
    setSelectedPersonId(node.id);
    setSelectedEdgeId(null);
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
    const newPerson: Person = {
      name: t("person.newPerson"),
      birth_year: null,
      death_year: null,
      gender: "other",
      is_adopted: false,
      notes: null,
    };
    mutations.createPerson.mutate(newPerson, {
      onSuccess: (response) => {
        newlyCreatedNodeRef.current = response.id;
        setSelectedPersonId(response.id);
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
        <div className="tree-toolbar">
          <span className="tree-toolbar__title">{treeName ?? t("tree.untitled")}</span>
          <div className="tree-toolbar__spacer" />
          <Link to="/trees" className="tree-toolbar__btn">
            {t("nav.trees")}
          </Link>
        </div>
        <div style={{ padding: 20 }}>{t("tree.decryptionError")}</div>
      </div>
    );
  }

  return (
    <div className="tree-workspace">
      <div className="tree-toolbar">
        <span className="tree-toolbar__title">{treeName ?? t("tree.untitled")}</span>
        <div className="tree-toolbar__spacer" />

        <div className="tree-toolbar__group">
          <button
            type="button"
            className="tree-toolbar__btn tree-toolbar__btn--primary"
            onClick={handleAddPerson}
            disabled={mutations.createPerson.isPending}
          >
            {t("tree.addPerson")}
          </button>
          <button
            type="button"
            className="tree-toolbar__btn"
            onClick={handleAutoLayout}
            disabled={!hasPinnedNodes}
          >
            {t("tree.autoLayout")}
          </button>
        </div>

        <div className="tree-toolbar__separator" />

        <div className="tree-toolbar__group">
          <Link
            to={`/trees/${uuidToCompact(treeId!)}/timeline`}
            className="tree-toolbar__icon-btn"
            aria-label={t("tree.timeline")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="7" />
              <polyline points="12 9 12 12 13.5 13.5" />
              <path d="M16.51 17.35l-.35 3.83a2 2 0 01-2 1.82H9.83a2 2 0 01-2-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 019.83 1h4.35a2 2 0 012 1.82l.35 3.83" />
            </svg>
          </Link>
          <Link to="/trees" className="tree-toolbar__icon-btn" aria-label={t("nav.trees")}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </Link>
        </div>

        <div className="tree-toolbar__separator" />

        <div className="tree-toolbar__group">
          <SettingsPanel
            settings={canvasSettings}
            onUpdate={updateCanvasSettings}
            className="tree-toolbar__icon-btn"
          />
          <button
            type="button"
            className="tree-toolbar__icon-btn"
            onClick={logout}
            aria-label={t("nav.logout")}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="tree-canvas-wrapper bg-gradient">
        <BranchDecoration />
        {isLoading ? (
          <div style={{ padding: 20 }}>{t("common.loading")}</div>
        ) : (
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
