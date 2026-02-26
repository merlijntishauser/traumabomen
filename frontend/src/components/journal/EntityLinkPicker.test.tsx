import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import { EntityLinkPicker } from "./EntityLinkPicker";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockPerson: DecryptedPerson = {
  id: "p1",
  name: "Alice",
  birth_year: 1950,
  birth_month: null,
  birth_day: null,
  death_year: null,
  death_month: null,
  death_day: null,
  cause_of_death: null,
  gender: "female",
  is_adopted: false,
  notes: null,
};

const mockEvent: DecryptedEvent = {
  id: "e1",
  title: "Loss of parent",
  description: "",
  category: "loss",
  approximate_date: "1980",
  severity: 3,
  tags: [],
  person_ids: ["p1"],
};

const mockLifeEvent: DecryptedLifeEvent = {
  id: "le1",
  title: "Moved abroad",
  description: "",
  category: "relocation",
  approximate_date: "1985",
  impact: 2,
  tags: [],
  person_ids: ["p1"],
};

const mockTurningPoint: DecryptedTurningPoint = {
  id: "tp1",
  title: "Started therapy",
  description: "",
  category: "recovery",
  approximate_date: "1990",
  impact: 4,
  tags: [],
  person_ids: ["p1"],
};

const mockClassification: DecryptedClassification = {
  id: "c1",
  dsm_category: "depressive",
  dsm_subcategory: "major_depressive",
  status: "diagnosed",
  diagnosis_year: 1988,
  periods: [],
  notes: null,
  person_ids: ["p1"],
};

const mockPattern: DecryptedPattern = {
  id: "pat1",
  name: "Cycle of loss",
  description: "Recurring loss pattern",
  color: "#2d8a5e",
  linked_entities: [],
  person_ids: ["p1"],
};

const emptyPersons = new Map<string, DecryptedPerson>();
const emptyEvents = new Map<string, DecryptedEvent>();
const emptyLifeEvents = new Map<string, DecryptedLifeEvent>();
const emptyTurningPoints = new Map<string, DecryptedTurningPoint>();
const emptyClassifications = new Map<string, DecryptedClassification>();
const emptyPatterns = new Map<string, DecryptedPattern>();

function renderPicker(overrides: Partial<Parameters<typeof EntityLinkPicker>[0]> = {}) {
  const defaultProps = {
    persons: emptyPersons,
    events: emptyEvents,
    lifeEvents: emptyLifeEvents,
    turningPoints: emptyTurningPoints,
    classifications: emptyClassifications,
    patterns: emptyPatterns,
    onSelect: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<EntityLinkPicker {...defaultProps} />);
  return defaultProps;
}

describe("EntityLinkPicker", () => {
  it("shows empty message when no entities exist", () => {
    renderPicker();

    expect(screen.getByText("journal.noEntities")).toBeInTheDocument();
  });

  it("renders person group", () => {
    renderPicker({ persons: new Map([["p1", mockPerson]]) });

    expect(screen.getByText("journal.entityType.person")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders trauma event group", () => {
    renderPicker({ events: new Map([["e1", mockEvent]]) });

    expect(screen.getByText("journal.entityType.traumaEvent")).toBeInTheDocument();
    expect(screen.getByText("Loss of parent")).toBeInTheDocument();
  });

  it("renders life event group", () => {
    renderPicker({ lifeEvents: new Map([["le1", mockLifeEvent]]) });

    expect(screen.getByText("journal.entityType.lifeEvent")).toBeInTheDocument();
    expect(screen.getByText("Moved abroad")).toBeInTheDocument();
  });

  it("renders turning point group", () => {
    renderPicker({ turningPoints: new Map([["tp1", mockTurningPoint]]) });

    expect(screen.getByText("journal.entityType.turningPoint")).toBeInTheDocument();
    expect(screen.getByText("Started therapy")).toBeInTheDocument();
  });

  it("renders classification group", () => {
    renderPicker({ classifications: new Map([["c1", mockClassification]]) });

    expect(screen.getByText("journal.entityType.classification")).toBeInTheDocument();
    expect(screen.getByText("dsm.sub.major_depressive")).toBeInTheDocument();
  });

  it("renders classification without subcategory using category label", () => {
    const noSub = { ...mockClassification, dsm_subcategory: "" };
    renderPicker({ classifications: new Map([["c1", noSub]]) });

    expect(screen.getByText("dsm.depressive")).toBeInTheDocument();
  });

  it("renders pattern group", () => {
    renderPicker({ patterns: new Map([["pat1", mockPattern]]) });

    expect(screen.getByText("journal.entityType.pattern")).toBeInTheDocument();
    expect(screen.getByText("Cycle of loss")).toBeInTheDocument();
  });

  it("calls onSelect and onClose when an item is clicked", () => {
    const props = renderPicker({ persons: new Map([["p1", mockPerson]]) });

    fireEvent.click(screen.getByText("Alice"));

    expect(props.onSelect).toHaveBeenCalledWith({
      entity_type: "person",
      entity_id: "p1",
    });
    expect(props.onClose).toHaveBeenCalled();
  });

  it("calls onClose when clicking outside the picker", () => {
    const props = renderPicker({ persons: new Map([["p1", mockPerson]]) });

    fireEvent.mouseDown(document.body);

    expect(props.onClose).toHaveBeenCalled();
  });

  it("does not call onClose when clicking inside the picker", () => {
    const props = renderPicker({ persons: new Map([["p1", mockPerson]]) });

    fireEvent.mouseDown(screen.getByTestId("entity-link-picker"));

    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("renders multiple groups when multiple entity types are present", () => {
    renderPicker({
      persons: new Map([["p1", mockPerson]]),
      events: new Map([["e1", mockEvent]]),
      patterns: new Map([["pat1", mockPattern]]),
    });

    expect(screen.getByText("journal.entityType.person")).toBeInTheDocument();
    expect(screen.getByText("journal.entityType.traumaEvent")).toBeInTheDocument();
    expect(screen.getByText("journal.entityType.pattern")).toBeInTheDocument();
  });
});
