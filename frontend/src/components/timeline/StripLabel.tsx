import type { LaneOrientation } from "./markerHelpers";

export function StripLabel({
  orientation,
  startPos,
  labelKey,
  label,
}: {
  orientation: LaneOrientation;
  startPos: number;
  labelKey: string;
  label: string;
}) {
  const lbl = orientation.stripLabelAt(startPos, labelKey);
  return (
    <text
      x={lbl.x}
      y={lbl.y}
      className="tl-marker-label"
      textAnchor={lbl.textAnchor}
      transform={lbl.transform}
    >
      {label}
    </text>
  );
}
