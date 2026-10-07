/**
 * Reading a free-text date the way a person writes one: "1997", "1963-1970",
 * "the sixties", "at 12", "as a child", "in her twenties", "'85". English and
 * Dutch. Calendar dates read directly; ages, life stages and two-digit years
 * are read relative to a person and resolved against their birth year.
 */

export type DateReading =
  /** Calendar years. */
  | { kind: "years"; from: number; to: number; approx: boolean }
  /** An age or a stage of life, always approximate. */
  | { kind: "ages"; from: number; to: number }
  /** Two-digit years ('85), resolved against a birth year. */
  | { kind: "short"; from: number; to: number };

/** The oldest age a life stage like "old age" reaches; clipped to the life when drawn. */
const LATE_LIFE_END = 110;
const MAX_AGE = 120;

/** Words that mark a calendar date as a guess. */
const APPROX_WORDS = new Set([
  "c.",
  "ca",
  "ca.",
  "circa",
  "about",
  "around",
  "approx",
  "approx.",
  "approximately",
  "ongeveer",
  "rond",
  "omstreeks",
]);

const DECADE_WORDS: Record<string, number> = {
  twenties: 20,
  thirties: 30,
  forties: 40,
  fifties: 50,
  sixties: 60,
  seventies: 70,
  eighties: 80,
  nineties: 90,
  twintig: 20,
  dertig: 30,
  veertig: 40,
  vijftig: 50,
  zestig: 60,
  zeventig: 70,
  tachtig: 80,
  negentig: 90,
};

const DECADE_WORD = Object.keys(DECADE_WORDS).join("|");
const PRONOUN_EN = "(?:he|she|they|i|we|you)";
const PRONOUN_NL = "(?:hij|ze|zij|ik|we|wij|je|jij)";
const POSSESSIVE_EN = "(?:his|her|their|my|our|your)";

/** Life stages and the ages they span, most specific first. */
const LIFE_STAGES: [RegExp, number, number][] = [
  [/\b(?:as an? (?:baby|infant|newborn)|infancy|als baby|als zuigeling)\b/, 0, 1],
  [/\b(?:as a toddler|als peuter|peutertijd)\b/, 1, 3],
  [/\bearly childhood\b/, 0, 5],
  [/\b(?:pre-?school|kindergarten|kleuter(?:tijd|school)?)\b/, 3, 6],
  [/\b(?:primary|elementary|grade) school\b|\bbasisschool\b/, 4, 12],
  [/\b(?:high school|secondary school|middelbare school)\b/, 12, 18],
  [
    /\b(?:as an? (?:teen|teenager|adolescent)|teens|teenage years|adolescence|puberty|als (?:tiener|puber)|puberteit|tienerjaren|tienertijd)\b/,
    13,
    19,
  ],
  [/\b(?:young adult(?:hood)?|jongvolwassen(?:e|heid)?)\b/, 18, 25],
  [
    /\b(?:(?:at|in|during) (?:university|college)|studententijd|studietijd|tijdens (?:de|haar|zijn) studie)\b/,
    18,
    23,
  ],
  [/\b(?:middle[- ]age(?:d)?|middelbare leeftijd)\b/, 40, 60],
  [
    /\b(?:old age|later life|late in life|retire(?:d|ment)|ouderdom|pensioen|op (?:oudere|latere|hoge) leeftijd)\b/,
    65,
    LATE_LIFE_END,
  ],
  [new RegExp(`\\bwhen ${PRONOUN_EN} (?:was|were) (?:little|small|young)\\b`), 0, 12],
  [new RegExp(`\\btoen ${PRONOUN_NL} (?:klein|jong) was\\b`), 0, 12],
  [
    /\b(?:as an? (?:child|kid|little (?:boy|girl))|childhood|als kind|kindertijd|kinderjaren)\b/,
    0,
    12,
  ],
  [/\bjeugd\b/, 0, 18],
];

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[–—]/g, "-")
    .trim();
}

function isApproximate(text: string): boolean {
  if (/[~?]/.test(text)) return true;
  return text.split(/\s+/).some((word) => APPROX_WORDS.has(word));
}

/** Two-digit decades without a century: 00s and 10s are this century, the rest the last. */
function centuryDecade(tens: number): number {
  return tens < 2 ? 2000 + tens * 10 : 1900 + tens * 10;
}

function readCalendar(text: string): DateReading | null {
  const decade = text.match(/\b(\d{3})0s\b/);
  if (decade) {
    const from = Number(decade[1]) * 10;
    return { kind: "years", from, to: from + 9, approx: true };
  }
  const years = (text.match(/\b\d{4}\b/g) ?? []).map(Number);
  if (years.length === 0) return null;
  const from = years[0];
  const to = years.length > 1 && years[1] >= from ? years[1] : from;
  return { kind: "years", from, to, approx: isApproximate(text) };
}

function readDecadeWords(text: string): DateReading | null {
  const numeric = text.match(/\b(?:the|jaren)\s+'?(\d)0'?s?\b/);
  const word = text.match(new RegExp(`\\b(?:the|jaren)\\s+(${DECADE_WORD})\\b`));
  let tens: number | null = null;
  if (numeric) tens = Number(numeric[1]);
  else if (word) tens = DECADE_WORDS[word[1]] / 10;
  if (tens == null) return null;
  const from = centuryDecade(tens);
  return { kind: "years", from, to: from + 9, approx: true };
}

function ageSpan(from: number, to: number = from): DateReading | null {
  if (from > MAX_AGE || to > MAX_AGE || to < from) return null;
  return { kind: "ages", from, to };
}

function readAges(text: string): DateReading | null {
  const range = text.match(
    /\b(?:ages?|aged|at|between|tussen|leeftijd)\s+(\d{1,3})\s*(?:-|to|and|tot|en)\s*(\d{1,3})\b/,
  );
  if (range) return ageSpan(Number(range[1]), Number(range[2]));
  const patterns = [
    /\b(?:at the age of|at age|aged|age|at)\s+(\d{1,3})\b/,
    /\b(\d{1,3})\s*(?:years? old|jaar oud)\b/,
    /\bop\s+(?:(?:zijn|haar|hun|mijn|je|jouw|onze)\s+)?(\d{1,3})(?:e|ste|de)?(?:\s|$)/,
    /\b(\d{1,3})-?jarige?\b/,
    new RegExp(`\\btoen ${PRONOUN_NL} (\\d{1,3})(?: jaar)? (?:oud )?was\\b`),
    new RegExp(`\\bwhen ${PRONOUN_EN} (?:was|were) (\\d{1,3})\\b`),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return ageSpan(Number(match[1]));
  }
  return null;
}

function readLifeStage(text: string): DateReading | null {
  const decadeOfLife =
    text.match(new RegExp(`\\b(?:in|during) ${POSSESSIVE_EN}\\s+(${DECADE_WORD}|\\d0s)\\b`)) ??
    text.match(new RegExp(`\\bin de (${DECADE_WORD})\\b`)) ??
    text.match(new RegExp(`\\b(${DECADE_WORD})er\\b`));
  if (decadeOfLife) {
    const key = decadeOfLife[1];
    const from = key in DECADE_WORDS ? DECADE_WORDS[key] : Number(key.slice(0, 2));
    return ageSpan(from, from + 9);
  }
  for (const [pattern, from, to] of LIFE_STAGES) {
    if (pattern.test(text)) return ageSpan(from, to);
  }
  return null;
}

function readShortYears(text: string): DateReading | null {
  const match = text.match(/'(\d{2})\b(?:\s*-\s*'?(\d{2})\b)?/);
  if (!match) return null;
  const from = Number(match[1]);
  return { kind: "short", from, to: match[2] == null ? from : Number(match[2]) };
}

/** Read a free-text date. Null when there is nothing to place. */
export function readDate(text: string | null | undefined): DateReading | null {
  if (!text) return null;
  const normal = normalise(text);
  if (!normal) return null;
  return (
    readCalendar(normal) ??
    readDecadeWords(normal) ??
    readAges(normal) ??
    readLifeStage(normal) ??
    readShortYears(normal)
  );
}

/** The first year at or after `from` that ends in the two digits `yy`. */
function yearEnding(yy: number, from: number): number {
  const year = Math.floor(from / 100) * 100 + yy;
  return year < from ? year + 100 : year;
}

/**
 * The calendar years a reading covers for one person, or null when it needs a
 * birth year the person does not have.
 */
export function yearsFor(
  reading: DateReading,
  birthYear: number | null,
): { from: number; to: number; approx: boolean } | null {
  if (reading.kind === "years")
    return { from: reading.from, to: reading.to, approx: reading.approx };
  if (birthYear == null) return null;
  if (reading.kind === "ages") {
    return { from: birthYear + reading.from, to: birthYear + reading.to, approx: true };
  }
  const from = yearEnding(reading.from, birthYear);
  return { from, to: yearEnding(reading.to, from), approx: false };
}

export interface PlacedPerson {
  name: string;
  /** Ages for a calendar reading, calendar years for an age or two-digit reading. */
  from: number;
  to: number;
}

/**
 * Where a reading lands for the people an entry belongs to: their ages for a
 * calendar date, their calendar years for an age. People born after a calendar
 * date, or without a birth year for an age, are left out.
 */
export function placeForPeople(
  reading: DateReading,
  people: { name: string; birthYear: number | null }[],
): PlacedPerson[] {
  const placed: PlacedPerson[] = [];
  for (const { name, birthYear } of people) {
    if (reading.kind === "years") {
      if (birthYear == null || reading.to < birthYear) continue;
      placed.push({
        name,
        from: Math.max(0, reading.from - birthYear),
        to: reading.to - birthYear,
      });
      continue;
    }
    const years = yearsFor(reading, birthYear);
    if (years) placed.push({ name, from: years.from, to: years.to });
  }
  return placed;
}
