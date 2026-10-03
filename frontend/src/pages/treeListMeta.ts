import { formatRelativeTime } from "../lib/relativeTime";

interface TreeMeta {
  person_count: number;
  moment_count: number;
  pattern_count: number;
  updated_at: string;
}

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

/**
 * One quiet line of life per tree: "4 people · 12 moments · 2 patterns ·
 * updated 3 days ago". Zero counts stay silent; an untouched tree only says so.
 */
export function buildTreeMetaLine(tree: TreeMeta, t: TFunc, locale: string): string {
  const parts: string[] = [];
  if (tree.person_count > 0) parts.push(t("tree.meta.people", { count: tree.person_count }));
  if (tree.moment_count > 0) parts.push(t("tree.meta.moments", { count: tree.moment_count }));
  if (tree.pattern_count > 0) parts.push(t("tree.meta.patterns", { count: tree.pattern_count }));
  // "Not started yet · updated this minute" contradicts itself; an untouched
  // tree only says it has not been started.
  if (parts.length === 0) return t("tree.meta.empty");

  const tended = formatRelativeTime(tree.updated_at, locale);
  if (tended) parts.push(t("tree.meta.updated", { time: tended }));

  return parts.join(" · ");
}

/** Most recently tended first; ties keep their original order. */
export function sortByRecentlyTended<T extends { updated_at: string }>(trees: readonly T[]): T[] {
  return [...trees].sort((a, b) =>
    a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0,
  );
}
