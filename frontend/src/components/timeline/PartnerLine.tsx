import React, { useCallback } from "react";
import { PartnerStatus } from "../../types/domain";
import type { TooltipLine } from "./timelineHelpers";
import { ROW_HEIGHT } from "./timelineHelpers";

interface PartnerLineProps {
  sourceName: string;
  targetName: string;
  sourceY: number;
  targetY: number;
  periods: Array<{
    start_year: number;
    end_year: number | null;
    status: PartnerStatus;
  }>;
  xScale: (year: number) => number;
  currentYear: number;
  cssVar: (name: string) => string;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onTooltip: (state: { visible: boolean; x: number; y: number; lines: TooltipLine[] }) => void;
}

export const PartnerLine = React.memo(function PartnerLine({
  sourceName,
  targetName,
  sourceY,
  targetY,
  periods,
  xScale,
  currentYear,
  cssVar,
  t,
  onTooltip,
}: PartnerLineProps) {
  const midY = (sourceY + ROW_HEIGHT / 2 + targetY + ROW_HEIGHT / 2) / 2;

  const hideTooltip = useCallback(() => {
    onTooltip({ visible: false, x: 0, y: 0, lines: [] });
  }, [onTooltip]);

  return (
    <g>
      {periods.map((period, i) => {
        const px1 = xScale(period.start_year);
        const px2 = xScale(period.end_year ?? currentYear);
        const isDashed =
          period.status === PartnerStatus.Separated || period.status === PartnerStatus.Divorced;
        const statusLabel = t(`relationship.status.${period.status}`);
        const yearRange = `${period.start_year}${period.end_year ? ` - ${period.end_year}` : " -"}`;

        return (
          <g key={i}>
            {/* Visible line */}
            <line
              x1={px1}
              x2={px2}
              y1={midY}
              y2={midY}
              stroke={cssVar("--color-edge-partner")}
              strokeWidth={2}
              strokeDasharray={isDashed ? "6 3" : undefined}
            />
            {/* Invisible hover target */}
            <line
              x1={px1}
              x2={px2}
              y1={midY}
              y2={midY}
              stroke="transparent"
              strokeWidth={12}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => {
                onTooltip({
                  visible: true,
                  x: e.clientX,
                  y: e.clientY,
                  lines: [
                    { text: `${sourceName} \u2014 ${targetName}`, bold: true },
                    { text: `${statusLabel} ${yearRange}` },
                  ],
                });
              }}
              onMouseLeave={hideTooltip}
            />
          </g>
        );
      })}
    </g>
  );
});
