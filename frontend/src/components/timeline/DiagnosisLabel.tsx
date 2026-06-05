import type { LaneOrientation } from "./markerHelpers";

export function DiagnosisLabel({
  orientation,
  diagnosisYear,
  labelKey,
  label,
}: {
  orientation: LaneOrientation;
  diagnosisYear: number;
  labelKey: string;
  label: string;
}) {
  const lbl = orientation.diagLabelAt(diagnosisYear, labelKey);
  return (
    <text x={lbl.x} y={lbl.y} className="tl-marker-label" textAnchor={lbl.textAnchor}>
      {label}
    </text>
  );
}
