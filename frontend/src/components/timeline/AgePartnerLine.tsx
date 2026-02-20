import React, { useCallback } from "react";
import { PartnerStatus } from "../../types/domain";
import type { TooltipLine } from "./timelineHelpers";
import { BAR_HEIGHT } from "./timelineHelpers";

interface AgePartnerLineProps {
  sourceName: string;
  targetName: string;
  sourceX: number | null;
  targetX: number | null;
  sourceLaneWidth: number;
  targetLaneWidth: number;
  periods: Array<{
    start_year: number;
    end_year: number | null;
    status: PartnerStatus;
  }>;
  ageScale: (age: number) => number;
  birthYears: { source: number; target: number };
  currentYear: number;
  cssVar: (name: string) => string;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onTooltip: (state: { visible: boolean; x: number; y: number; lines: TooltipLine[] }) => void;
}

const BAR_OFFSET_X = BAR_HEIGHT / 2 + 2;

export const AgePartnerLine = React.memo(function AgePartnerLine({
  sourceName,
  targetName,
  sourceX,
  targetX,
  sourceLaneWidth,
  targetLaneWidth,
  periods,
  ageScale,
  birthYears,
  currentYear,
  cssVar,
  t,
  onTooltip,
}: AgePartnerLineProps) {
  const hideTooltip = useCallback(() => {
    onTooltip({ visible: false, x: 0, y: 0, lines: [] });
  }, [onTooltip]);

  if (sourceX == null && targetX == null) return null;

  // Position the bar at the inner edge of each partner's lane (facing the other partner).
  // If source is to the left of target, source bar goes on right edge, target on left edge, and vice versa.
  const srcIsLeft = sourceX != null && targetX != null && sourceX < targetX;
  const effectiveSrcBarX =
    sourceX != null
      ? srcIsLeft
        ? sourceX + sourceLaneWidth - BAR_OFFSET_X
        : sourceX + BAR_OFFSET_X
      : null;
  const effectiveTgtBarX =
    targetX != null
      ? srcIsLeft
        ? targetX + BAR_OFFSET_X
        : targetX + targetLaneWidth - BAR_OFFSET_X
      : null;

  return (
    <g>
      {periods.map((period) => {
        const isDashed =
          period.status === PartnerStatus.Separated || period.status === PartnerStatus.Divorced;
        const statusLabel = t(`relationship.status.${period.status}`);
        const yearRange = `${period.start_year}${period.end_year ? ` - ${period.end_year}` : " -"}`;
        const strokeColor = cssVar("--color-edge-partner");
        const dashArray = isDashed ? "6 3" : undefined;

        const tooltipLines: TooltipLine[] = [
          { text: `${sourceName} \u2014 ${targetName}`, bold: true },
          { text: `${statusLabel} ${yearRange}` },
        ];

        const showTooltip = (e: React.MouseEvent) => {
          onTooltip({ visible: true, x: e.clientX, y: e.clientY, lines: tooltipLines });
        };

        // Convert calendar years to age for each partner
        const srcStartAge = period.start_year - birthYears.source;
        const srcEndAge = (period.end_year ?? currentYear) - birthYears.source;
        const tgtStartAge = period.start_year - birthYears.target;
        const tgtEndAge = (period.end_year ?? currentYear) - birthYears.target;

        const srcY1 = ageScale(srcStartAge);
        const srcY2 = ageScale(srcEndAge);
        const tgtY1 = ageScale(tgtStartAge);
        const tgtY2 = ageScale(tgtEndAge);

        // Connector Y: use the average of both partners' start-age Y positions
        const connectorY =
          effectiveSrcBarX != null && effectiveTgtBarX != null
            ? (srcY1 + tgtY1) / 2
            : (srcY1 ?? tgtY1);

        return (
          <g key={`${period.start_year}-${period.status}`}>
            {/* Horizontal connector between partner columns */}
            {effectiveSrcBarX != null && effectiveTgtBarX != null && (
              <line
                x1={effectiveSrcBarX}
                x2={effectiveTgtBarX}
                y1={connectorY}
                y2={connectorY}
                stroke={strokeColor}
                strokeWidth={1.5}
                strokeDasharray={dashArray}
                strokeOpacity={0.4}
              />
            )}
            {/* Source partner vertical bar */}
            {effectiveSrcBarX != null && (
              <>
                <line
                  x1={effectiveSrcBarX}
                  x2={effectiveSrcBarX}
                  y1={srcY1}
                  y2={srcY2}
                  stroke={strokeColor}
                  strokeWidth={2}
                  strokeDasharray={dashArray}
                />
                <line
                  x1={effectiveSrcBarX}
                  x2={effectiveSrcBarX}
                  y1={srcY1}
                  y2={srcY2}
                  stroke="transparent"
                  strokeWidth={10}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={showTooltip}
                  onMouseLeave={hideTooltip}
                />
              </>
            )}
            {/* Target partner vertical bar */}
            {effectiveTgtBarX != null && (
              <>
                <line
                  x1={effectiveTgtBarX}
                  x2={effectiveTgtBarX}
                  y1={tgtY1}
                  y2={tgtY2}
                  stroke={strokeColor}
                  strokeWidth={2}
                  strokeDasharray={dashArray}
                />
                <line
                  x1={effectiveTgtBarX}
                  x2={effectiveTgtBarX}
                  y1={tgtY1}
                  y2={tgtY2}
                  stroke="transparent"
                  strokeWidth={10}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={showTooltip}
                  onMouseLeave={hideTooltip}
                />
              </>
            )}
          </g>
        );
      })}
    </g>
  );
});
