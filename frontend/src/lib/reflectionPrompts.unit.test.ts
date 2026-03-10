import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import {
  getNudgePrompt,
  getPatternPrompt,
  getPersonPrompt,
  getRandomJournalPrompts,
} from "./reflectionPrompts";

const mockT: TFunction = ((key: string, options?: Record<string, string>) => {
  if (options?.name) return `${key} [${options.name}]`;
  return key;
}) as TFunction;

describe("reflectionPrompts", () => {
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

  describe("getPersonPrompt", () => {
    it("returns a non-empty string", () => {
      const prompt = getPersonPrompt(mockT, "Alice");
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("includes the person name in the result", () => {
      const prompt = getPersonPrompt(mockT, "Alice");
      expect(prompt).toContain("Alice");
    });

    it("uses a person prompt key", () => {
      const prompt = getPersonPrompt(mockT, "Bob");
      expect(prompt).toMatch(/^prompt\.person\.\d+ \[Bob]$/);
    });
  });

  describe("getPatternPrompt", () => {
    it("returns a non-empty string", () => {
      const prompt = getPatternPrompt(mockT);
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("uses a pattern prompt key", () => {
      const prompt = getPatternPrompt(mockT);
      expect(prompt).toMatch(/^prompt\.pattern\.\d+$/);
    });
  });

  describe("getNudgePrompt", () => {
    it("returns a non-empty string", () => {
      const prompt = getNudgePrompt(mockT);
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(0);
    });

    it("uses a journal prompt key", () => {
      const prompt = getNudgePrompt(mockT);
      expect(prompt).toMatch(/^prompt\.journal\.\d+$/);
    });
  });
});
