import type { ReactNode } from "react";
import type { StripeKind } from "../../lib/familyStripes";
import { starPoints } from "./geometry";

interface StripeMarkProps {
  kind: StripeKind;
  color: string;
  /** Suspected classifications are drawn hollow. */
  hollow?: boolean;
  size?: number;
  className?: string;
}

/** An entry's badge in the canvas grammar: circle, square, triangle, star. */
export function StripeMark({ kind, color, hollow = false, size = 12, className }: StripeMarkProps) {
  const h = size / 2;
  const paint = hollow ? { fill: "none", stroke: color, strokeWidth: 1.6 } : { fill: color };
  let shape: ReactNode;
  if (kind === "trauma_event") shape = <circle cx={h} cy={h} r={h - 0.5} {...paint} />;
  else if (kind === "life_event")
    shape = <rect x={1} y={1} width={size - 2} height={size - 2} rx={1.5} {...paint} />;
  else if (kind === "classification")
    shape = (
      <polygon
        points={`${h},1 ${size - 1},${size - 1} 1,${size - 1}`}
        strokeLinejoin="round"
        {...paint}
      />
    );
  else shape = <polygon points={starPoints(h, h + 0.5, h)} {...paint} />;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      focusable="false"
    >
      {shape}
    </svg>
  );
}
