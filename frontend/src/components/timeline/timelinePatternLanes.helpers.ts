import type { DecryptedPattern } from "../../hooks/useTreeData";
import { getPatternColor } from "../../lib/patternColors";
import type { PatternRingsMap } from "./TimelinePatternLanes";

export function computePatternRings(
  patterns: Map<string, DecryptedPattern>,
  visiblePatternIds: Set<string>,
): PatternRingsMap {
  const rings: PatternRingsMap = new Map();

  for (const [patternId, pattern] of patterns) {
    if (!visiblePatternIds.has(patternId)) continue;
    const color = getPatternColor(pattern.color);

    for (const le of pattern.linked_entities) {
      const key = `${le.entity_type}:${le.entity_id}`;
      const existing = rings.get(key) ?? [];
      existing.push({ color, patternId });
      rings.set(key, existing);
    }
  }

  return rings;
}
