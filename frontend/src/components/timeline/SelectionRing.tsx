import { MARKER_RADIUS } from "./timelineHelpers";

export function SelectionRing({
  mx,
  my,
  isSelected,
}: {
  mx: number;
  my: number;
  isSelected: boolean | undefined;
}) {
  if (!isSelected) return null;
  return <circle cx={mx} cy={my} r={MARKER_RADIUS + 3} className="tl-selection-ring" />;
}
