import type { TFunction } from "i18next";

const JOURNAL_PROMPT_COUNT = 10;
const PERSON_PROMPT_COUNT = 8;
const PATTERN_PROMPT_COUNT = 6;

/** Fisher-Yates shuffle of an index array and return the first `count` elements. */
function shuffledIndices(total: number, count: number): number[] {
  const indices = Array.from({ length: total }, (_, i) => i + 1);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count);
}

/** Pick `count` random journal prompt indices (selection stays stable until re-picked). */
export function pickJournalPromptIndices(count = 3): number[] {
  return shuffledIndices(JOURNAL_PROMPT_COUNT, count);
}

/** Pick a single random journal prompt index. */
export function pickJournalPromptIndex(): number {
  return Math.floor(Math.random() * JOURNAL_PROMPT_COUNT) + 1;
}

/** Pick a random person-context prompt index. */
export function pickPersonPromptIndex(): number {
  return Math.floor(Math.random() * PERSON_PROMPT_COUNT) + 1;
}

/** Pick a random pattern-context prompt index. */
export function pickPatternPromptIndex(): number {
  return Math.floor(Math.random() * PATTERN_PROMPT_COUNT) + 1;
}

/** Translate a journal prompt index. Kept separate from selection so translation
 * stays live (follows the active language) without re-rolling the random pick. */
export function journalPromptText(t: TFunction, index: number): string {
  return t(`prompt.journal.${index}`);
}

/** Translate a person-context prompt index, interpolating the person name. */
export function personPromptText(t: TFunction, index: number, name: string): string {
  return t(`prompt.person.${index}`, { name });
}

/** Translate a pattern-context prompt index. */
export function patternPromptText(t: TFunction, index: number): string {
  return t(`prompt.pattern.${index}`);
}

/** Return `count` random journal prompts (translated). */
export function getRandomJournalPrompts(t: TFunction, count = 3): string[] {
  return pickJournalPromptIndices(count).map((i) => journalPromptText(t, i));
}
