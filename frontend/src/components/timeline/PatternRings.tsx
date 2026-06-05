import type { PatternRingsMap } from "./TimelinePatternLanes";
import { MARKER_RADIUS } from "./timelineHelpers";

export function PatternRings({
  mx,
  my,
  entityKey,
  patternRings,
}: {
  mx: number;
  my: number;
  entityKey: string;
  patternRings?: PatternRingsMap;
}) {
  const rings = patternRings?.get(entityKey);
  if (!rings) return null;
  return (
    <>
      {rings.map((ring, ri) => (
        <circle
          key={ring.patternId}
          cx={mx}
          cy={my}
          r={MARKER_RADIUS + 2 + ri * 2}
          fill="none"
          stroke={ring.color}
          strokeWidth={1.5}
          strokeOpacity={0.7}
          className="tl-pattern-ring"
        />
      ))}
    </>
  );
}
