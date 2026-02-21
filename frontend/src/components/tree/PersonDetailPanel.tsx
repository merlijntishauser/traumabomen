import { CalendarDays, Circle, GitFork, Square, Star, Triangle, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import type { InferredSibling } from "../../lib/inferSiblings";
import type {
  Classification,
  LifeEvent,
  Person,
  RelationshipData,
  TraumaEvent,
  TurningPoint,
} from "../../types/domain";
import { ClassificationsTab } from "./ClassificationsTab";
import { LifeEventsTab } from "./LifeEventsTab";
import { PersonTab } from "./PersonTab";
import { RelationshipsTab } from "./RelationshipsTab";
import { TraumaEventsTab } from "./TraumaEventsTab";
import { TurningPointsTab } from "./TurningPointsTab";
import "./PersonDetailPanel.css";

export type PersonDetailSection =
  | "person"
  | "relationships"
  | "trauma_event"
  | "life_event"
  | "turning_point"
  | "classification"
  | null;

export type DetailTab = "person" | "relationships" | "events" | "classifications";

type EventSubTab = "trauma" | "life" | "turning";

const TAB_CLASS = "detail-panel__tab";
const TAB_ACTIVE_CLASS = `${TAB_CLASS} ${TAB_CLASS}--active`;
const SEG_CLASS = "detail-panel__segment";
const SEG_ACTIVE_CLASS = `${SEG_CLASS} ${SEG_CLASS}--active`;

function tabClassName(isActive: boolean): string {
  return isActive ? TAB_ACTIVE_CLASS : TAB_CLASS;
}

function segClassName(isActive: boolean): string {
  return isActive ? SEG_ACTIVE_CLASS : SEG_CLASS;
}

function sectionToTab(section: PersonDetailSection): DetailTab {
  switch (section) {
    case "person":
      return "person";
    case "relationships":
      return "relationships";
    case "trauma_event":
    case "life_event":
    case "turning_point":
      return "events";
    case "classification":
      return "classifications";
    default:
      return "person";
  }
}

function sectionToEventSubTab(section: PersonDetailSection): EventSubTab | null {
  switch (section) {
    case "trauma_event":
      return "trauma";
    case "life_event":
      return "life";
    case "turning_point":
      return "turning";
    default:
      return null;
  }
}

interface PersonDetailPanelProps {
  person: DecryptedPerson;
  relationships: DecryptedRelationship[];
  inferredSiblings: InferredSibling[];
  events: DecryptedEvent[];
  lifeEvents: DecryptedLifeEvent[];
  turningPoints: DecryptedTurningPoint[];
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
  onSaveTurningPoint: (
    turningPointId: string | null,
    data: TurningPoint,
    personIds: string[],
  ) => void;
  onDeleteTurningPoint: (turningPointId: string) => void;
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
  turningPoints,
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
  onSaveTurningPoint,
  onDeleteTurningPoint,
  onSaveClassification,
  onDeleteClassification,
  onClose,
}: PersonDetailPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<DetailTab>(sectionToTab(initialSection ?? null));
  const [eventSubTab, setEventSubTab] = useState<EventSubTab>(
    sectionToEventSubTab(initialSection ?? null) ?? "trauma",
  );

  useEffect(() => {
    if (initialSection) {
      setActiveTab(sectionToTab(initialSection));
      const sub = sectionToEventSubTab(initialSection);
      if (sub) setEventSubTab(sub);
    }
  }, [initialSection]);

  const relsCount = relationships.length + inferredSiblings.length;
  const eventsCount = events.length + lifeEvents.length + turningPoints.length;

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
          aria-selected={activeTab === "events"}
          className={tabClassName(activeTab === "events")}
          onClick={() => setActiveTab("events")}
        >
          <CalendarDays size={14} />
          {t("events.tab")}
          {eventsCount > 0 && <span className="detail-panel__tab-badge">{eventsCount}</span>}
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
        {activeTab === "events" && (
          <>
            <div className="detail-panel__segment-control">
              <button
                type="button"
                className={segClassName(eventSubTab === "trauma")}
                onClick={() => setEventSubTab("trauma")}
              >
                <Circle size={10} />
                {t("trauma.tab")}
              </button>
              <button
                type="button"
                className={segClassName(eventSubTab === "life")}
                onClick={() => setEventSubTab("life")}
              >
                <Square size={10} />
                {t("lifeEvent.tab")}
              </button>
              <button
                type="button"
                className={segClassName(eventSubTab === "turning")}
                onClick={() => setEventSubTab("turning")}
              >
                <Star size={10} />
                {t("turningPoint.tab")}
              </button>
            </div>
            {eventSubTab === "trauma" && (
              <TraumaEventsTab
                person={person}
                events={events}
                allPersons={allPersons}
                onSaveEvent={onSaveEvent}
                onDeleteEvent={onDeleteEvent}
                initialEditId={initialSection === "trauma_event" ? initialEntityId : undefined}
              />
            )}
            {eventSubTab === "life" && (
              <LifeEventsTab
                person={person}
                lifeEvents={lifeEvents}
                allPersons={allPersons}
                onSaveLifeEvent={onSaveLifeEvent}
                onDeleteLifeEvent={onDeleteLifeEvent}
                initialEditId={initialSection === "life_event" ? initialEntityId : undefined}
              />
            )}
            {eventSubTab === "turning" && (
              <TurningPointsTab
                person={person}
                turningPoints={turningPoints}
                allPersons={allPersons}
                onSaveTurningPoint={onSaveTurningPoint}
                onDeleteTurningPoint={onDeleteTurningPoint}
                initialEditId={initialSection === "turning_point" ? initialEntityId : undefined}
              />
            )}
          </>
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
