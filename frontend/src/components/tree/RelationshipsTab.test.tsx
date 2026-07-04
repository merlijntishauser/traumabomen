import { fireEvent, render, screen } from "@testing-library/react";
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
    onSaveRelationship: vi.fn().mockResolvedValue(undefined),
  };
};

describe("RelationshipsTab", () => {
  describe("empty state", () => {
    it("shows empty message when no relationships or inferred siblings", () => {
      render(<RelationshipsTab {...defaultProps()} />);
      expect(screen.getByText("relationship.none")).toBeInTheDocument();
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

      // Autosaving editor: no save or cancel, only a close button
      expect(screen.getByText("relationship.addPeriod")).toBeInTheDocument();
      expect(screen.getByText("common.close")).toBeInTheDocument();
      expect(screen.queryByText("common.save")).not.toBeInTheDocument();
      expect(screen.queryByText("common.cancel")).not.toBeInTheDocument();
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

    it("starts empty when no periods exist", async () => {
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

      // No seeded default period: adding one is the explicit act that creates it
      expect(screen.queryByText("common.startYear")).not.toBeInTheDocument();
      expect(screen.getByText("relationship.addPeriod")).toBeInTheDocument();
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

      // Should now have two start year labels, and the add committed immediately
      const startYearLabels = screen.getAllByText("common.startYear");
      expect(startYearLabels).toHaveLength(2);
      expect(props.onSaveRelationship).toHaveBeenCalledOnce();
    });

    it("removes a period and commits when remove button is clicked", async () => {
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

      // One period row left; the removal committed immediately
      expect(screen.getAllByText("common.startYear")).toHaveLength(1);
      expect(props.onSaveRelationship).toHaveBeenCalledWith(
        "r1",
        expect.objectContaining({
          type: RelationshipType.Partner,
          periods: [{ start_year: 2008, end_year: null, status: PartnerStatus.Together }],
        }),
      );
    });

    it("shows a remove button even when only one period exists", async () => {
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

      expect(screen.getByText("relationship.removePeriod")).toBeInTheDocument();
    });

    it("commits a status change immediately", async () => {
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
      await user.selectOptions(
        screen.getByRole("combobox", { name: "relationship.status" }),
        PartnerStatus.Married,
      );

      expect(props.onSaveRelationship).toHaveBeenCalledOnce();
      const [relId, data] = props.onSaveRelationship.mock.calls[0];
      expect(relId).toBe("r1");
      expect(data.type).toBe(RelationshipType.Partner);
      expect(data.periods).toEqual([
        { start_year: 2000, end_year: null, status: PartnerStatus.Married },
      ]);
    });

    it("commits a year change on blur", async () => {
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

      const startYearInput = screen.getByRole("textbox", { name: "common.startYear" });
      fireEvent.change(startYearInput, { target: { value: "1995" } });
      expect(props.onSaveRelationship).not.toHaveBeenCalled();
      fireEvent.blur(startYearInput);

      expect(props.onSaveRelationship).toHaveBeenCalledWith(
        "r1",
        expect.objectContaining({
          periods: [{ start_year: 1995, end_year: null, status: PartnerStatus.Together }],
        }),
      );
    });

    it("closes period editor without saving when nothing changed", async () => {
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
      expect(screen.getByText("relationship.addPeriod")).toBeInTheDocument();

      await user.click(screen.getByText("common.close"));

      // Should be back to showing the edit button; a clean close saves nothing
      expect(screen.getByText("common.edit")).toBeInTheDocument();
      expect(screen.queryByText("relationship.addPeriod")).not.toBeInTheDocument();
      expect(props.onSaveRelationship).not.toHaveBeenCalled();
    });

    it("flushes a pending year edit when the editor is closed", async () => {
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

      const startYearInput = screen.getByRole("textbox", { name: "common.startYear" });
      fireEvent.change(startYearInput, { target: { value: "1998" } });

      await user.click(screen.getByText("common.close"));

      // Closing loses nothing: the pending edit committed on unmount
      expect(props.onSaveRelationship).toHaveBeenCalledWith(
        "r1",
        expect.objectContaining({
          periods: [{ start_year: 1998, end_year: null, status: PartnerStatus.Together }],
        }),
      );
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
