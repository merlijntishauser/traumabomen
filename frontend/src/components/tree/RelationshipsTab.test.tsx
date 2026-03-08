import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type {
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedSiblingGroup,
} from "../../hooks/useTreeData";
import type { InferredSibling } from "../../lib/inferSiblings";
import { PartnerStatus, RelationshipType } from "../../types/domain";
import { RelationshipsTab } from "./RelationshipsTab";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts?.name) return `${key}:${opts.name}`;
      if (opts?.count !== undefined) return `${key}:${opts.count}`;
      return key;
    },
    i18n: { language: "en" },
  }),
}));

function makePerson(overrides: Partial<DecryptedPerson> = {}): DecryptedPerson {
  return {
    id: "p1",
    name: "Alice",
    birth_year: 1960,
    birth_month: null,
    birth_day: null,
    death_year: null,
    death_month: null,
    death_day: null,
    cause_of_death: null,
    gender: "female",
    is_adopted: false,
    notes: null,
    ...overrides,
  };
}

function makeRelationship(overrides: Partial<DecryptedRelationship> = {}): DecryptedRelationship {
  return {
    id: "r1",
    type: RelationshipType.Partner,
    source_person_id: "p1",
    target_person_id: "p2",
    periods: [],
    active_period: null,
    ...overrides,
  };
}

const defaultProps = () => {
  const allPersons = new Map<string, DecryptedPerson>([
    ["p1", makePerson({ id: "p1", name: "Alice" })],
    ["p2", makePerson({ id: "p2", name: "Bob" })],
    ["p3", makePerson({ id: "p3", name: "Charlie" })],
  ]);
  return {
    person: makePerson(),
    relationships: [] as DecryptedRelationship[],
    inferredSiblings: [] as InferredSibling[],
    allPersons,
    onSaveRelationship: vi.fn(),
  };
};

describe("RelationshipsTab", () => {
  describe("empty state", () => {
    it("shows empty message when no relationships or inferred siblings", () => {
      render(<RelationshipsTab {...defaultProps()} />);
      expect(screen.getByText("---")).toBeInTheDocument();
    });
  });

  describe("relationship list", () => {
    it("renders the other person name for each relationship", () => {
      const props = defaultProps();
      props.relationships = [
        makeRelationship({
          id: "r1",
          type: RelationshipType.Partner,
          source_person_id: "p1",
          target_person_id: "p2",
        }),
      ];
      render(<RelationshipsTab {...props} />);
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });

    it("renders the relationship type label", () => {
      const props = defaultProps();
      props.relationships = [makeRelationship({ type: RelationshipType.BiologicalParent })];
      render(<RelationshipsTab {...props} />);
      // When person is the source (child), should use childOf key
      expect(screen.getByText("relationship.childOf.biological_parent")).toBeInTheDocument();
    });

    it("renders partner type for non-parent relationships", () => {
      const props = defaultProps();
      props.relationships = [makeRelationship({ type: RelationshipType.Partner })];
      render(<RelationshipsTab {...props} />);
      expect(screen.getByText("relationship.type.partner")).toBeInTheDocument();
    });

    it("shows ex-partner label when all partner periods have ended", () => {
      const props = defaultProps();
      props.relationships = [
        makeRelationship({
          type: RelationshipType.Partner,
          periods: [{ start_year: 2000, end_year: 2010, status: PartnerStatus.Married }],
        }),
      ];
      render(<RelationshipsTab {...props} />);
      expect(screen.getByText("relationship.type.exPartner")).toBeInTheDocument();
    });

    it("does not show ex-partner label when a period has no end year", () => {
      const props = defaultProps();
      props.relationships = [
        makeRelationship({
          type: RelationshipType.Partner,
          periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Married }],
        }),
      ];
      render(<RelationshipsTab {...props} />);
      expect(screen.getByText("relationship.type.partner")).toBeInTheDocument();
    });

    it("shows question mark for unknown other person", () => {
      const props = defaultProps();
      props.relationships = [
        makeRelationship({
          target_person_id: "unknown-id",
        }),
      ];
      render(<RelationshipsTab {...props} />);
      expect(screen.getByText("?")).toBeInTheDocument();
    });

    it("shows period details for partner relationships", () => {
      const props = defaultProps();
      props.relationships = [
        makeRelationship({
          type: RelationshipType.Partner,
          periods: [{ start_year: 2000, end_year: 2010, status: PartnerStatus.Married }],
        }),
      ];
      render(<RelationshipsTab {...props} />);
      expect(screen.getByText(/relationship.status.married/)).toBeInTheDocument();
      expect(screen.getByText(/2000/)).toBeInTheDocument();
    });

    it("shows ongoing period without end year", () => {
      const props = defaultProps();
      props.relationships = [
        makeRelationship({
          type: RelationshipType.Partner,
          periods: [{ start_year: 2015, end_year: null, status: PartnerStatus.Together }],
        }),
      ];
      render(<RelationshipsTab {...props} />);
      expect(screen.getByText("relationship.status.together: 2015 -")).toBeInTheDocument();
    });

    it("shows edit button for partner relationships", () => {
      const props = defaultProps();
      props.relationships = [makeRelationship({ type: RelationshipType.Partner })];
      render(<RelationshipsTab {...props} />);
      expect(screen.getByText("common.edit")).toBeInTheDocument();
    });

    it("does not show edit button for non-partner relationships", () => {
      const props = defaultProps();
      props.relationships = [makeRelationship({ type: RelationshipType.BiologicalParent })];
      render(<RelationshipsTab {...props} />);
      expect(screen.queryByText("common.edit")).not.toBeInTheDocument();
    });

    it("renders target person type when person is target of parent relationship", () => {
      const props = defaultProps();
      props.relationships = [
        makeRelationship({
          type: RelationshipType.BiologicalParent,
          source_person_id: "p2",
          target_person_id: "p1",
        }),
      ];
      render(<RelationshipsTab {...props} />);
      // Person is target, so should use childOf key
      // source_person_id != person.id (p1), so isSource = false
      // isParentType = true, but isSource = false, so it uses type.
      expect(screen.getByText("relationship.type.biological_parent")).toBeInTheDocument();
    });
  });

  describe("inferred siblings", () => {
    it("renders inferred siblings with type and name", () => {
      const props = defaultProps();
      props.inferredSiblings = [
        {
          personAId: "p1",
          personBId: "p3",
          type: "half_sibling",
          sharedParentIds: ["p2"],
        },
      ];
      render(<RelationshipsTab {...props} />);
      expect(screen.getByText("relationship.type.half_sibling")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
    });

    it("shows shared parent names for inferred siblings", () => {
      const props = defaultProps();
      props.inferredSiblings = [
        {
          personAId: "p1",
          personBId: "p3",
          type: "half_sibling",
          sharedParentIds: ["p2"],
        },
      ];
      render(<RelationshipsTab {...props} />);
      expect(screen.getByText("relationship.viaParent:Bob")).toBeInTheDocument();
    });

    it("shows other person name when current person is personB", () => {
      const props = defaultProps();
      props.inferredSiblings = [
        {
          personAId: "p3",
          personBId: "p1",
          type: "full_sibling",
          sharedParentIds: ["p2"],
        },
      ];
      render(<RelationshipsTab {...props} />);
      expect(screen.getByText("Charlie")).toBeInTheDocument();
    });
  });

  describe("partner period editor", () => {
    it("opens period editor when edit button is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.relationships = [
        makeRelationship({
          type: RelationshipType.Partner,
          periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
        }),
      ];
      render(<RelationshipsTab {...props} />);

      await user.click(screen.getByText("common.edit"));

      // Should show period editor with save and cancel buttons
      expect(screen.getByText("common.save")).toBeInTheDocument();
      expect(screen.getByText("common.cancel")).toBeInTheDocument();
    });

    it("shows status select in period editor", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.relationships = [
        makeRelationship({
          type: RelationshipType.Partner,
          periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
        }),
      ];
      render(<RelationshipsTab {...props} />);

      await user.click(screen.getByText("common.edit"));

      expect(screen.getByText("relationship.status")).toBeInTheDocument();
      expect(screen.getByText("common.startYear")).toBeInTheDocument();
      expect(screen.getByText("common.endYear")).toBeInTheDocument();
    });

    it("initializes with a default period when no periods exist", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.relationships = [
        makeRelationship({
          type: RelationshipType.Partner,
          periods: [],
        }),
      ];
      render(<RelationshipsTab {...props} />);

      await user.click(screen.getByText("common.edit"));

      // Should have a period with current year as start
      expect(screen.getByText("common.startYear")).toBeInTheDocument();
    });

    it("adds a new period when add period button is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.relationships = [
        makeRelationship({
          type: RelationshipType.Partner,
          periods: [{ start_year: 2000, end_year: 2005, status: PartnerStatus.Married }],
        }),
      ];
      render(<RelationshipsTab {...props} />);

      await user.click(screen.getByText("common.edit"));
      await user.click(screen.getByText("relationship.addPeriod"));

      // Should now have two start year labels
      const startYearLabels = screen.getAllByText("common.startYear");
      expect(startYearLabels).toHaveLength(2);
    });

    it("removes a period when remove button is clicked (multiple periods)", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.relationships = [
        makeRelationship({
          type: RelationshipType.Partner,
          periods: [
            { start_year: 2000, end_year: 2005, status: PartnerStatus.Married },
            { start_year: 2008, end_year: null, status: PartnerStatus.Together },
          ],
        }),
      ];
      render(<RelationshipsTab {...props} />);

      await user.click(screen.getByText("common.edit"));

      // Should have 2 periods with remove buttons
      const removeButtons = screen.getAllByText("relationship.removePeriod");
      expect(removeButtons).toHaveLength(2);

      await user.click(removeButtons[0]);

      // Should now have 1 period and no remove buttons (single period)
      expect(screen.getAllByText("common.startYear")).toHaveLength(1);
    });

    it("does not show remove button when only one period exists", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.relationships = [
        makeRelationship({
          type: RelationshipType.Partner,
          periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
        }),
      ];
      render(<RelationshipsTab {...props} />);

      await user.click(screen.getByText("common.edit"));

      expect(screen.queryByText("relationship.removePeriod")).not.toBeInTheDocument();
    });

    it("calls onSaveRelationship with updated data when save is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.relationships = [
        makeRelationship({
          id: "r1",
          type: RelationshipType.Partner,
          periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
          active_period: null,
        }),
      ];
      render(<RelationshipsTab {...props} />);

      await user.click(screen.getByText("common.edit"));
      await user.click(screen.getByText("common.save"));

      expect(props.onSaveRelationship).toHaveBeenCalledOnce();
      const [relId, data] = props.onSaveRelationship.mock.calls[0];
      expect(relId).toBe("r1");
      expect(data.type).toBe(RelationshipType.Partner);
      expect(data.periods.length).toBeGreaterThanOrEqual(1);
    });

    it("closes period editor when cancel is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      props.relationships = [
        makeRelationship({
          type: RelationshipType.Partner,
          periods: [{ start_year: 2000, end_year: null, status: PartnerStatus.Together }],
        }),
      ];
      render(<RelationshipsTab {...props} />);

      await user.click(screen.getByText("common.edit"));
      expect(screen.getByText("common.save")).toBeInTheDocument();

      await user.click(screen.getByText("common.cancel"));

      // Should be back to showing the edit button
      expect(screen.getByText("common.edit")).toBeInTheDocument();
      expect(screen.queryByText("common.save")).not.toBeInTheDocument();
    });
  });

  describe("sibling group section", () => {
    it("shows add sibling group button when onCreateSiblingGroup is provided", () => {
      const props = defaultProps();
      // Need at least one relationship or the section won't render
      props.relationships = [makeRelationship()];
      render(<RelationshipsTab {...props} onCreateSiblingGroup={vi.fn()} />);
      expect(screen.getByText("siblingGroup.add")).toBeInTheDocument();
    });

    it("shows edit sibling group button when siblingGroup exists", () => {
      const props = defaultProps();
      const siblingGroup: DecryptedSiblingGroup = {
        id: "sg1",
        person_ids: ["p1"],
        members: [{ name: "Dave", birth_year: 1962 }],
      };
      render(
        <RelationshipsTab
          {...props}
          siblingGroup={siblingGroup}
          onOpenSiblingGroup={vi.fn()}
          onCreateSiblingGroup={vi.fn()}
        />,
      );
      expect(screen.getByText("siblingGroup.edit:1")).toBeInTheDocument();
    });

    it("calls onCreateSiblingGroup when add button is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      const onCreateSiblingGroup = vi.fn();
      render(<RelationshipsTab {...props} onCreateSiblingGroup={onCreateSiblingGroup} />);

      await user.click(screen.getByText("siblingGroup.add"));
      expect(onCreateSiblingGroup).toHaveBeenCalledOnce();
    });

    it("calls onOpenSiblingGroup with group id when edit button is clicked", async () => {
      const user = userEvent.setup();
      const props = defaultProps();
      const onOpenSiblingGroup = vi.fn();
      const siblingGroup: DecryptedSiblingGroup = {
        id: "sg1",
        person_ids: ["p1"],
        members: [{ name: "Dave", birth_year: 1962 }],
      };
      render(
        <RelationshipsTab
          {...props}
          siblingGroup={siblingGroup}
          onOpenSiblingGroup={onOpenSiblingGroup}
          onCreateSiblingGroup={vi.fn()}
        />,
      );

      await user.click(screen.getByText("siblingGroup.edit:1"));
      expect(onOpenSiblingGroup).toHaveBeenCalledWith("sg1");
    });

    it("does not show sibling group section when neither handler is provided", () => {
      const props = defaultProps();
      props.relationships = [makeRelationship()];
      render(<RelationshipsTab {...props} />);
      expect(screen.queryByText("siblingGroup.section")).not.toBeInTheDocument();
    });
  });

  describe("friend relationship", () => {
    it("renders friend relationship type correctly", () => {
      const props = defaultProps();
      props.relationships = [
        makeRelationship({
          type: RelationshipType.Friend,
          source_person_id: "p1",
          target_person_id: "p2",
        }),
      ];
      render(<RelationshipsTab {...props} />);
      expect(screen.getByText("relationship.type.friend")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  describe("multiple relationships", () => {
    it("renders all relationships in a list", () => {
      const props = defaultProps();
      props.relationships = [
        makeRelationship({
          id: "r1",
          type: RelationshipType.Partner,
          source_person_id: "p1",
          target_person_id: "p2",
        }),
        makeRelationship({
          id: "r2",
          type: RelationshipType.Friend,
          source_person_id: "p1",
          target_person_id: "p3",
        }),
      ];
      render(<RelationshipsTab {...props} />);
      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("Charlie")).toBeInTheDocument();
    });
  });
});
