import type { TFunction } from "i18next";
import { type DateReading, type PlacedPerson, placeForPeople, readDate } from "./dateReading";
import { firstName } from "./familyStripes";
import { conjunctionFormatter } from "./listFormat";

/** People named in the sentence; the rest are counted. */
const MAX_NAMED = 3;
/** Ages from here up read as "from age 65" (a stage that runs to the end of life). */
const OPEN_ENDED_AGE = 100;

function span(from: number, to: number, t: TFunction): string {
  return from === to ? String(from) : t("dateHint.range", { from, to });
}

/** "Harold was 12", "Harold was 5 to 12", or "2 more" for whoever does not fit. */
function namedList(
  placed: PlacedPerson[],
  item: (p: PlacedPerson) => string,
  t: TFunction,
  language: string,
) {
  const items = placed.slice(0, MAX_NAMED).map(item);
  if (placed.length > MAX_NAMED)
    items.push(t("dateHint.more", { count: placed.length - MAX_NAMED }));
  return conjunctionFormatter(language).format(items);
}

function whatTheAgesAre(reading: Extract<DateReading, { kind: "ages" }>, t: TFunction): string {
  if (reading.from === reading.to) return t("dateHint.age", { age: reading.from });
  if (reading.to >= OPEN_ENDED_AGE) return t("dateHint.fromAge", { age: reading.from });
  return t("dateHint.ages", { from: reading.from, to: reading.to });
}

/** The sentence under a date field: how the timeline will read what was typed. */
export function dateReadingSentence(
  text: string,
  people: { name: string; birthYear: number | null }[],
  t: TFunction,
  language: string,
): string | null {
  if (!text.trim()) return null;
  const reading = readDate(text);
  if (!reading) return t("dateHint.none");
  const placed = placeForPeople(reading, people);

  if (reading.kind === "years") {
    let when = span(reading.from, reading.to, t);
    if (reading.approx) when = t("dateHint.about", { when });
    if (placed.length === 0) return t("dateHint.reads", { when });
    const who = namedList(
      placed,
      (p) => t("dateHint.personAge", { name: firstName(p.name), age: span(p.from, p.to, t) }),
      t,
      language,
    );
    return t("dateHint.readsWhen", { when, who });
  }

  const what =
    reading.kind === "ages"
      ? whatTheAgesAre(reading, t)
      : `'${String(reading.from).padStart(2, "0")}${reading.to === reading.from ? "" : `-'${String(reading.to).padStart(2, "0")}`}`;
  if (placed.length === 0) return t("dateHint.needsBirth", { what });
  const openEnded = reading.kind === "ages" && reading.to >= OPEN_ENDED_AGE;
  const where = namedList(
    placed,
    (p) =>
      t("dateHint.yearsFor", {
        years: openEnded ? t("dateHint.fromYear", { year: p.from }) : span(p.from, p.to, t),
        name: firstName(p.name),
      }),
    t,
    language,
  );
  return t("dateHint.readsFor", { what, where });
}
