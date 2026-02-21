import { Circle, GitFork, Square, Triangle, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
} from "../../hooks/useTreeData";
import type { InferredSibling } from "../../lib/inferSiblings";
import type {
  Classification,
  LifeEvent,
  Person,
  RelationshipData,
  TraumaEvent,
} from "../../types/domain";
import { ClassificationsTab } from "./ClassificationsTab";
import { LifeEventsTab } from "./LifeEventsTab";
import { PersonTab } from "./PersonTab";
import { RelationshipsTab } from "./RelationshipsTab";
import { TraumaEventsTab } from "./TraumaEventsTab";
import "./PersonDetailPanel.css";

export type PersonDetailSection =
  | "person"
  | "relationships"
  | "trauma_event"
  | "life_event"
  | "classification"
  | null;

export type DetailTab = "person" | "relationships" | "trauma" | "life" | "classifications";

const TAB_CLASS = "detail-panel__tab";
const TAB_ACTIVE_CLASS = `${TAB_CLASS} ${TAB_CLASS}--active`;

function tabClassName(isActive: boolean): string {
  return isActive ? TAB_ACTIVE_CLASS : TAB_CLASS;
}

function sectionToTab(section: PersonDetailSection): DetailTab {
  switch (section) {
    case "person":
      return "person";
    case "relationships":
      return "relationships";
    case "trauma_event":
      return "trauma";
    case "life_event":
      return "life";
    case "classification":
      return "classifications";
    default:
      return "person";
  }
}

interface PersonDetailPanelProps {
  person: DecryptedPerson;
  relationships: DecryptedRelationship[];
  inferredSiblings: InferredSibling[];
  events: DecryptedEvent[];
  lifeEvents: DecryptedLifeEvent[];
  classifications: DecryptedClassification[];
  allPersons: Map<string, DecryptedPerson>;
  initialSection?: PersonDetailSection;
  initialEntityId?: string;
  onSavePerson: (data: Person) => void;
  onDeletePerson: (personId: string) => void;
  onSaveRelationship: (relationshipId: string, data: RelationshipData) => void;
  onSaveEvent: (eventId: string | null, data: TraumaEvent, personIds: string[]) => void;
  onDeleteEvent: (eventId: string) => void;
  onSaveLifeEvent: (lifeEventId: string | null, data: LifeEvent, personIds: string[]) => void;
  onDeleteLifeEvent: (lifeEventId: string) => void;
  onSaveClassification: (
    classificationId: string | null,
    data: Classification,
    personIds: string[],
  ) => void;
  onDeleteClassification: (classificationId: string) => void;
  onClose: () => void;
}

export function PersonDetailPanel({
  person,
  relationships,
  inferredSiblings,
  events,
  lifeEvents,
  classifications,
  allPersons,
  initialSection,
  initialEntityId,
  onSavePerson,
  onDeletePerson,
  onSaveRelationship,
  onSaveEvent,
  onDeleteEvent,
  onSaveLifeEvent,
  onDeleteLifeEvent,
  onSaveClassification,
  onDeleteClassification,
  onClose,
}: PersonDetailPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<DetailTab>(sectionToTab(initialSection ?? null));

  useEffect(() => {
    if (initialSection) {
      setActiveTab(sectionToTab(initialSection));
    }
  }, [initialSection]);

  const relsCount = relationships.length + inferredSiblings.length;

  function formatYears(): string {
    const by = person.birth_year;
    if (by == null) return "";
    const dy = person.death_year;
    return dy != null ? `${by} - ${dy}` : `${by} -`;
  }

  return (
    <div className="detail-panel">
      <div className="detail-panel__person-header">
        <div className="detail-panel__person-info">
          <h2 className="detail-panel__person-name">{person.name}</h2>
          {person.birth_year != null && (
            <span className="detail-panel__person-years">{formatYears()}</span>
          )}
        </div>
        <button type="button" className="detail-panel__close" onClick={onClose}>
          {t("common.close")}
        </button>
      </div>

      <div className="detail-panel__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "person"}
          className={tabClassName(activeTab === "person")}
          onClick={() => setActiveTab("person")}
        >
          <User size={14} />
          {t("person.tab")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "relationships"}
          className={tabClassName(activeTab === "relationships")}
          onClick={() => setActiveTab("relationships")}
        >
          <GitFork size={14} />
          {t("relationship.tab")}
          {relsCount > 0 && <span className="detail-panel__tab-badge">{relsCount}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "trauma"}
          className={tabClassName(activeTab === "trauma")}
          onClick={() => setActiveTab("trauma")}
        >
          <Circle size={14} />
          {t("trauma.tab")}
          {events.length > 0 && <span className="detail-panel__tab-badge">{events.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "life"}
          className={tabClassName(activeTab === "life")}
          onClick={() => setActiveTab("life")}
        >
          <Square size={14} />
          {t("lifeEvent.tab")}
          {lifeEvents.length > 0 && (
            <span className="detail-panel__tab-badge">{lifeEvents.length}</span>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "classifications"}
          className={tabClassName(activeTab === "classifications")}
          onClick={() => setActiveTab("classifications")}
        >
          <Triangle size={14} />
          {t("classification.tab")}
          {classifications.length > 0 && (
            <span className="detail-panel__tab-badge">{classifications.length}</span>
          )}
        </button>
      </div>

      <div className="detail-panel__content">
        {activeTab === "person" && (
          <PersonTab person={person} onSavePerson={onSavePerson} onDeletePerson={onDeletePerson} />
        )}
        {activeTab === "relationships" && (
          <RelationshipsTab
            person={person}
            relationships={relationships}
            inferredSiblings={inferredSiblings}
            allPersons={allPersons}
            onSaveRelationship={onSaveRelationship}
          />
        )}
        {activeTab === "trauma" && (
          <TraumaEventsTab
            person={person}
            events={events}
            allPersons={allPersons}
            onSaveEvent={onSaveEvent}
            onDeleteEvent={onDeleteEvent}
            initialEditId={initialSection === "trauma_event" ? initialEntityId : undefined}
          />
        )}
        {activeTab === "life" && (
          <LifeEventsTab
            person={person}
            lifeEvents={lifeEvents}
            allPersons={allPersons}
            onSaveLifeEvent={onSaveLifeEvent}
            onDeleteLifeEvent={onDeleteLifeEvent}
            initialEditId={initialSection === "life_event" ? initialEntityId : undefined}
          />
        )}
        {activeTab === "classifications" && (
          <ClassificationsTab
            person={person}
            classifications={classifications}
            allPersons={allPersons}
            onSaveClassification={onSaveClassification}
            onDeleteClassification={onDeleteClassification}
            initialEditId={initialSection === "classification" ? initialEntityId : undefined}
          />
        )}
      </div>
    </div>
  );
}
