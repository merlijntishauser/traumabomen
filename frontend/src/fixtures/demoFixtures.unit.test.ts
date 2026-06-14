import { describe, expect, it } from "vitest";
import { buildDemoState } from "../lib/buildDemoState";
import type { DemoFixture } from "../lib/createDemoTree";
import { derivePersonIds } from "../lib/patternEntities";
import enFixture from "./demo-tree-en.json";
import nlFixture from "./demo-tree-nl.json";

const fixtures: [string, DemoFixture][] = [
  ["en", enFixture as unknown as DemoFixture],
  ["nl", nlFixture as unknown as DemoFixture],
];

describe("demo fixtures", () => {
  for (const [lang, fixture] of fixtures) {
    const state = buildDemoState(fixture);

    // A pattern's person_ids is the union of the persons its linked entities
    // touch (the app derives it on save). If a fixture drifts from that, the
    // spotlight count says one number while listing another and members go
    // unhighlighted, so guard both fixtures against it.
    it(`${lang}: every pattern's person_ids match the persons its linked entities touch`, () => {
      for (const pattern of state.patterns.values()) {
        const derived = derivePersonIds(pattern.linked_entities, {
          events: state.events,
          lifeEvents: state.lifeEvents,
          turningPoints: state.turningPoints,
          classifications: state.classifications,
        });
        expect(new Set(pattern.person_ids)).toEqual(new Set(derived));
      }
    });
  }
});
