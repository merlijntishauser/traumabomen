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
 * updated 3 days ago". Zero counts stay silent; an untouched tree says so.
 */
export function buildTreeMetaLine(tree: TreeMeta, t: TFunc, locale: string): string {
  const parts: string[] = [];
  if (tree.person_count > 0) parts.push(t("tree.meta.people", { count: tree.person_count }));
  if (tree.moment_count > 0) parts.push(t("tree.meta.moments", { count: tree.moment_count }));
  if (tree.pattern_count > 0) parts.push(t("tree.meta.patterns", { count: tree.pattern_count }));
  if (parts.length === 0) parts.push(t("tree.meta.empty"));

  const tended = formatRelativeTime(tree.updated_at, locale);
  if (tended) parts.push(t("tree.meta.updated", { time: tended }));

  return parts.join(" · ");
}
