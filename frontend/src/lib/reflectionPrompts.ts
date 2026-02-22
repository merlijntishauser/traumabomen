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

/** Return `count` random journal prompts (translated). */
export function getRandomJournalPrompts(t: TFunction, count = 3): string[] {
  return shuffledIndices(JOURNAL_PROMPT_COUNT, count).map((i) => t(`prompt.journal.${i}`));
}

/** Return a random person-context prompt (translated). */
export function getPersonPrompt(t: TFunction, name: string): string {
  const i = Math.floor(Math.random() * PERSON_PROMPT_COUNT) + 1;
  return t(`prompt.person.${i}`, { name });
}

/** Return a random pattern-context prompt (translated). */
export function getPatternPrompt(t: TFunction): string {
  const i = Math.floor(Math.random() * PATTERN_PROMPT_COUNT) + 1;
  return t(`prompt.pattern.${i}`);
}

/** Return a single random journal prompt for the canvas nudge. */
export function getNudgePrompt(t: TFunction): string {
  const i = Math.floor(Math.random() * JOURNAL_PROMPT_COUNT) + 1;
  return t(`prompt.journal.${i}`);
}
