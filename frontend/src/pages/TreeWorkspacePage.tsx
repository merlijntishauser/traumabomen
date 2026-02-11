import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ReactFlowProvider,
  ReactFlow,
  useReactFlow,
  applyNodeChanges,
  type OnConnect,
  type OnNodesChange,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTranslation } from "react-i18next";
import { useLogout } from "../hooks/useLogout";
import { useTreeData } from "../hooks/useTreeData";
import { useTreeMutations } from "../hooks/useTreeMutations";
import { useTreeLayout } from "../hooks/useTreeLayout";
import type { PersonNodeType, RelationshipEdgeType } from "../hooks/useTreeLayout";
import { PersonNode } from "../components/tree/PersonNode";
import { RelationshipEdge } from "../components/tree/RelationshipEdge";
import { PersonDetailPanel } from "../components/tree/PersonDetailPanel";
import { inferSiblings } from "../lib/inferSiblings";
import type { InferredSibling } from "../lib/inferSiblings";
import { RelationshipType } from "../types/domain";
import type { Person, TraumaEvent, RelationshipData } from "../types/domain";
import "../components/tree/TreeCanvas.css";

const nodeTypes = { person: PersonNode };
const edgeTypes = { relationship: RelationshipEdge };

function TreeWorkspaceInner() {
  const { id: treeId } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const logout = useLogout();
  const { fitView } = useReactFlow<PersonNodeType, RelationshipEdgeType>();

  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(
    null,
  );

  const { persons, relationships, events, isLoading, error } = useTreeData(
    treeId!,
  );
  const mutations = useTreeMutations(treeId!);
  const { nodes: layoutNodes, edges } = useTreeLayout(
    persons,
    relationships,
    events,
    selectedPersonId,
  );

  // Local node state that accepts both layout updates and drag changes
  const [nodes, setNodes] = useState<PersonNodeType[]>([]);

  useEffect(() => {
    setNodes(layoutNodes);
  }, [layoutNodes]);

  const onNodesChange: OnNodesChange<PersonNodeType> = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [],
  );

  // Fit view when node count changes
  useEffect(() => {
    if (layoutNodes.length > 0) {
      const timer = setTimeout(() => fitView({ padding: 0.2 }), 50);
      return () => clearTimeout(timer);
    }
  }, [layoutNodes.length, fitView]);

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedPersonId(null);
        setPendingConnection(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: PersonNodeType) => {
      setSelectedPersonId(node.id);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
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
          (rel.source_person_id === connection.target &&
            rel.target_person_id === connection.source)
        ) {
          return;
        }
      }
      setPendingConnection(connection);
    },
    [relationships],
  );

  function handleAddPerson() {
    const newPerson: Person = {
      name: t("person.newPerson"),
      birth_year: new Date().getFullYear() - 30,
      death_year: null,
      gender: "other",
      is_adopted: false,
      notes: null,
    };
    mutations.createPerson.mutate(newPerson, {
      onSuccess: (response) => {
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

  function handleSaveEvent(
    eventId: string | null,
    data: TraumaEvent,
    personIds: string[],
  ) {
    if (eventId) {
      mutations.updateEvent.mutate({ eventId, personIds, data });
    } else {
      mutations.createEvent.mutate({ personIds, data });
    }
  }

  function handleDeleteEvent(eventId: string) {
    mutations.deleteEvent.mutate(eventId);
  }

  const selectedPerson = selectedPersonId
    ? persons.get(selectedPersonId)
    : null;

  const selectedRelationships = selectedPersonId
    ? Array.from(relationships.values()).filter(
        (r) =>
          r.source_person_id === selectedPersonId ||
          r.target_person_id === selectedPersonId,
      )
    : [];

  const selectedEvents = selectedPersonId
    ? Array.from(events.values()).filter((e) =>
        e.person_ids.includes(selectedPersonId),
      )
    : [];

  const inferredSiblings = useMemo(
    () => inferSiblings(relationships),
    [relationships],
  );

  const selectedInferredSiblings = selectedPersonId
    ? inferredSiblings.filter(
        (s) => s.personAId === selectedPersonId || s.personBId === selectedPersonId,
      )
    : [];

  if (error) {
    return (
      <div className="tree-workspace">
        <div className="tree-toolbar">
          <Link to="/trees" className="tree-toolbar__back">
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
        <Link to="/trees" className="tree-toolbar__back">
          {t("nav.trees")}
        </Link>
        <div className="tree-toolbar__spacer" />
        <button
          className="tree-toolbar__btn tree-toolbar__btn--primary"
          onClick={handleAddPerson}
          disabled={mutations.createPerson.isPending}
        >
          {t("tree.addPerson")}
        </button>
        <Link to={`/trees/${treeId}/timeline`} className="tree-toolbar__btn">
          {t("tree.timeline")}
        </Link>
        <button className="tree-toolbar__btn" onClick={logout}>
          {t("nav.logout")}
        </button>
      </div>

      <div className="tree-canvas-wrapper">
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
            onPaneClick={onPaneClick}
            onConnect={onConnect}
            fitView
            deleteKeyCode={null}
          />
        )}

        {selectedPerson && (
          <PersonDetailPanel
            person={selectedPerson}
            relationships={selectedRelationships}
            inferredSiblings={selectedInferredSiblings}
            events={selectedEvents}
            allPersons={persons}
            onSavePerson={handleSavePerson}
            onDeletePerson={handleDeletePerson}
            onSaveRelationship={handleSaveRelationship}
            onSaveEvent={handleSaveEvent}
            onDeleteEvent={handleDeleteEvent}
            onClose={() => setSelectedPersonId(null)}
          />
        )}
      </div>

      {pendingConnection && (
        <div
          className="relationship-popover"
          onClick={() => setPendingConnection(null)}
        >
          <div
            className="relationship-popover__card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{t("relationship.selectType")}</h3>
            <div className="relationship-popover__options">
              {Object.values(RelationshipType).map((type) => (
                <button
                  key={type}
                  className="relationship-popover__option"
                  onClick={() => handleCreateRelationship(type)}
                >
                  {t(`relationship.type.${type}`)}
                </button>
              ))}
            </div>
            <button
              className="relationship-popover__cancel"
              onClick={() => setPendingConnection(null)}
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
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
