import { describe, expect, it } from "vitest";
import { expandSiblingGroupConnection, siblingGroupIdFromNodeId } from "./siblingGroupConnect";

interface Rel {
  source_person_id: string;
  target_person_id: string;
}

function relMap(...rels: Rel[]): Map<string, Rel> {
  return new Map(rels.map((r, i) => [`r${i}`, r]));
}

const GROUP = { id: "sg1", person_ids: ["sophie", "lucas"] };
const PILL = "sibling-group-sg1";

describe("siblingGroupIdFromNodeId", () => {
  it("extracts the group id from a pill node id", () => {
    expect(siblingGroupIdFromNodeId("sibling-group-sg1")).toBe("sg1");
  });

  it("returns null for a person node id", () => {
    expect(siblingGroupIdFromNodeId("some-person-id")).toBeNull();
  });

  it("returns null for null or undefined", () => {
    expect(siblingGroupIdFromNodeId(null)).toBeNull();
    expect(siblingGroupIdFromNodeId(undefined)).toBeNull();
  });
});

describe("expandSiblingGroupConnection", () => {
  it("links each in-tree sibling to the other person when the pill is the source", () => {
    // Drag from the pill to a stepfather: each sibling becomes the source.
    const pairs = expandSiblingGroupConnection(PILL, "stepdad", GROUP, relMap());
    expect(pairs).toEqual([
      { sourcePersonId: "sophie", targetPersonId: "stepdad" },
      { sourcePersonId: "lucas", targetPersonId: "stepdad" },
    ]);
  });

  it("keeps the other person as source when the pill is the target", () => {
    // Drag from a stepfather to the pill: the stepfather is the source of each.
    const pairs = expandSiblingGroupConnection("stepdad", PILL, GROUP, relMap());
    expect(pairs).toEqual([
      { sourcePersonId: "stepdad", targetPersonId: "sophie" },
      { sourcePersonId: "stepdad", targetPersonId: "lucas" },
    ]);
  });

  it("skips the sibling that is the other endpoint (no self-edge)", () => {
    const pairs = expandSiblingGroupConnection(PILL, "sophie", GROUP, relMap());
    expect(pairs).toEqual([{ sourcePersonId: "lucas", targetPersonId: "sophie" }]);
  });

  it("skips pairs that already have a relationship in either direction", () => {
    const rels = relMap(
      { source_person_id: "sophie", target_person_id: "stepdad" },
      { source_person_id: "stepdad", target_person_id: "lucas" },
    );
    expect(expandSiblingGroupConnection("stepdad", PILL, GROUP, rels)).toEqual([]);
  });
});
