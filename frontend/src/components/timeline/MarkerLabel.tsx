import type { LaneOrientation } from "./markerHelpers";

export function MarkerLabel({
  orientation,
  year,
  labelKey,
  title,
}: {
  orientation: LaneOrientation;
  year: number;
  labelKey: string;
  title: string;
}) {
  const lbl = orientation.markerLabelAt(year, labelKey);
  return (
    <text x={lbl.x} y={lbl.y} className="tl-marker-label" textAnchor={lbl.textAnchor}>
      {title}
    </text>
  );
}
