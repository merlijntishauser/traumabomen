import type { DimSets, FilterMode } from "../../hooks/useTimelineFilters";
import type { DecryptedClassification } from "../../hooks/useTreeData";

export interface LabelEntry {
  x: number;
  w: number;
  key: string;
}

export function collectClassificationLabelEntries(
  classifications: DecryptedClassification[],
  dims: DimSets | undefined,
  filterMode: FilterMode,
  xScale: (year: number) => number,
  t: (key: string, opts?: Record<string, unknown>) => string,
  charW: number,
): LabelEntry[] {
  const entries: LabelEntry[] = [];
  for (const cls of classifications) {
    if (dims?.dimmedClassificationIds.has(cls.id) && filterMode === "hide") continue;
    if (cls.periods.length === 0) continue;
    const px = xScale(cls.periods[0].start_year);
    const sub = cls.dsm_subcategory ? t(`dsm.sub.${cls.dsm_subcategory}`) : null;
    const txt = sub ?? t(`dsm.${cls.dsm_category}`);
    entries.push({ x: px, w: txt.length * charW, key: `cs:${cls.id}` });

    if (
      cls.status === "diagnosed" &&
      cls.diagnosis_year != null &&
      cls.diagnosis_year !== cls.periods[0].start_year
    ) {
      const dx = xScale(cls.diagnosis_year);
      entries.push({ x: dx, w: txt.length * charW, key: `ct:${cls.id}` });
    }
  }
  return entries;
}

export function collectDateLabelEntries(
  items: ReadonlyArray<{ id: string; approximate_date: string; title: string }>,
  dimmedIds: ReadonlySet<string> | undefined,
  filterMode: FilterMode,
  xScale: (year: number) => number,
  charW: number,
  keyPrefix: string,
): LabelEntry[] {
  const entries: LabelEntry[] = [];
  for (const item of items) {
    const yr = Number.parseInt(item.approximate_date, 10);
    if (Number.isNaN(yr)) continue;
    if (dimmedIds?.has(item.id) && filterMode === "hide") continue;
    entries.push({ x: xScale(yr), w: item.title.length * charW, key: `${keyPrefix}:${item.id}` });
  }
  return entries;
}

export function stackLabels(
  entries: LabelEntry[],
  pad: number,
  lineH: number,
): Map<string, number> {
  entries.sort((a, b) => a.x - b.x);
  const offsets = new Map<string, number>();
  const levels: number[] = [-Infinity];

  for (const e of entries) {
    let placed = false;
    for (let i = 0; i < levels.length; i++) {
      if (e.x >= levels[i] + pad) {
        offsets.set(e.key, i * lineH);
        levels[i] = e.x + e.w;
        placed = true;
        break;
      }
    }
    if (!placed) {
      offsets.set(e.key, levels.length * lineH);
      levels.push(e.x + e.w);
    }
  }

  return offsets;
}
