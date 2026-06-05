import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import {
  getRandomJournalPrompts,
  journalPromptText,
  patternPromptText,
  personPromptText,
  pickJournalPromptIndex,
  pickJournalPromptIndices,
  pickPatternPromptIndex,
  pickPersonPromptIndex,
} from "./reflectionPrompts";

const mockT: TFunction = ((key: string, options?: Record<string, string>) => {
  if (options?.name) return `${key} [${options.name}]`;
  return key;
}) as TFunction;

describe("reflectionPrompts", () => {
  describe("pickJournalPromptIndices", () => {
    it("returns the requested number of indices", () => {
      expect(pickJournalPromptIndices(3)).toHaveLength(3);
    });

    it("defaults to 3 indices when count is omitted", () => {
      expect(pickJournalPromptIndices()).toHaveLength(3);
    });

    it("returns unique indices within the valid range", () => {
      const indices = pickJournalPromptIndices(10);
      expect(new Set(indices).size).toBe(indices.length);
      for (const i of indices) {
        expect(i).toBeGreaterThanOrEqual(1);
        expect(i).toBeLessThanOrEqual(10);
      }
    });
  });

  describe("single index pickers", () => {
    it("pickJournalPromptIndex stays within 1..10", () => {
      for (let n = 0; n < 50; n++) {
        const i = pickJournalPromptIndex();
        expect(i).toBeGreaterThanOrEqual(1);
        expect(i).toBeLessThanOrEqual(10);
      }
    });

    it("pickPersonPromptIndex stays within 1..8", () => {
      for (let n = 0; n < 50; n++) {
        const i = pickPersonPromptIndex();
        expect(i).toBeGreaterThanOrEqual(1);
        expect(i).toBeLessThanOrEqual(8);
      }
    });

    it("pickPatternPromptIndex stays within 1..6", () => {
      for (let n = 0; n < 50; n++) {
        const i = pickPatternPromptIndex();
        expect(i).toBeGreaterThanOrEqual(1);
        expect(i).toBeLessThanOrEqual(6);
      }
    });
  });

  describe("translation helpers", () => {
    it("journalPromptText builds a journal key", () => {
      expect(journalPromptText(mockT, 4)).toBe("prompt.journal.4");
    });

    it("personPromptText builds a person key and interpolates the name", () => {
      expect(personPromptText(mockT, 2, "Alice")).toBe("prompt.person.2 [Alice]");
    });

    it("patternPromptText builds a pattern key", () => {
      expect(patternPromptText(mockT, 5)).toBe("prompt.pattern.5");
    });
  });

  describe("getRandomJournalPrompts", () => {
    it("returns the requested number of prompts", () => {
      const prompts = getRandomJournalPrompts(mockT, 3);
      expect(prompts).toHaveLength(3);
    });

    it("returns non-empty strings", () => {
      const prompts = getRandomJournalPrompts(mockT, 5);
      for (const p of prompts) {
        expect(p).toBeTruthy();
        expect(typeof p).toBe("string");
        expect(p.length).toBeGreaterThan(0);
      }
    });

    it("returns unique prompts (no duplicates)", () => {
      const prompts = getRandomJournalPrompts(mockT, 5);
      const unique = new Set(prompts);
      expect(unique.size).toBe(prompts.length);
    });

    it("defaults to 3 prompts when count is omitted", () => {
      const prompts = getRandomJournalPrompts(mockT);
      expect(prompts).toHaveLength(3);
    });

    it("returns prompts matching the expected key pattern", () => {
      const prompts = getRandomJournalPrompts(mockT, 10);
      for (const p of prompts) {
        expect(p).toMatch(/^prompt\.journal\.\d+$/);
      }
    });
  });
});
