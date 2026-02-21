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
  onClick?: () => void;
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
  onClick,
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

  // Label offset: place on the outer side of each bar (away from partner)
  const LABEL_OFFSET = 8;
  const srcLabelOffsetX =
    effectiveSrcBarX != null && effectiveTgtBarX != null
      ? srcIsLeft
        ? -LABEL_OFFSET
        : LABEL_OFFSET
      : -LABEL_OFFSET;
  const tgtLabelOffsetX =
    effectiveSrcBarX != null && effectiveTgtBarX != null
      ? srcIsLeft
        ? LABEL_OFFSET
        : -LABEL_OFFSET
      : -LABEL_OFFSET;

  return (
    <g>
      {periods.map((period) => {
        const isDashed =
          period.status === PartnerStatus.Separated || period.status === PartnerStatus.Divorced;
        const statusLabel = t(`relationship.status.${period.status}`);
        const yearRange = `${period.start_year}${period.end_year ? ` - ${period.end_year}` : " -"}`;
        const strokeColor = cssVar("--color-edge-partner");
        const dashArray = isDashed ? "6 3" : undefined;
        const srcLabel = t("timeline.partnerLabel", { status: statusLabel, name: targetName });
        const tgtLabel = t("timeline.partnerLabel", { status: statusLabel, name: sourceName });

        const tooltipLines: TooltipLine[] = [
          { text: `${sourceName} & ${targetName}`, bold: true },
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

        // Connector Y: midpoint of the period, averaged between both partners
        const srcMidY = (srcY1 + srcY2) / 2;
        const tgtMidY = (tgtY1 + tgtY2) / 2;
        const connectorY =
          effectiveSrcBarX != null && effectiveTgtBarX != null
            ? (srcMidY + tgtMidY) / 2
            : (srcMidY ?? tgtMidY);

        return (
          <g key={`${period.start_year}-${period.status}`}>
            {/* Horizontal connector between partner columns */}
            {effectiveSrcBarX != null && effectiveTgtBarX != null && (
              <>
                <line
                  x1={effectiveSrcBarX}
                  x2={effectiveTgtBarX}
                  y1={connectorY}
                  y2={connectorY}
                  stroke={strokeColor}
                  strokeWidth={2.5}
                  strokeDasharray={dashArray}
                  strokeOpacity={0.6}
                />
                <line
                  x1={effectiveSrcBarX}
                  x2={effectiveTgtBarX}
                  y1={connectorY}
                  y2={connectorY}
                  stroke="transparent"
                  strokeWidth={10}
                  style={{ cursor: "pointer" }}
                  onMouseEnter={showTooltip}
                  onMouseLeave={hideTooltip}
                  onClick={onClick}
                />
              </>
            )}
            {/* Source partner vertical bar + label */}
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
                <text
                  x={effectiveSrcBarX + srcLabelOffsetX}
                  y={(srcY1 + srcY2) / 2}
                  fill={strokeColor}
                  fontSize={10}
                  textAnchor="middle"
                  className="tl-partner-label"
                  transform={`rotate(-90, ${effectiveSrcBarX + srcLabelOffsetX}, ${(srcY1 + srcY2) / 2})`}
                >
                  {srcLabel}
                </text>
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
                  onClick={onClick}
                />
              </>
            )}
            {/* Target partner vertical bar + label */}
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
                <text
                  x={effectiveTgtBarX + tgtLabelOffsetX}
                  y={(tgtY1 + tgtY2) / 2}
                  fill={strokeColor}
                  fontSize={10}
                  textAnchor="middle"
                  className="tl-partner-label"
                  transform={`rotate(-90, ${effectiveTgtBarX + tgtLabelOffsetX}, ${(tgtY1 + tgtY2) / 2})`}
                >
                  {tgtLabel}
                </text>
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
                  onClick={onClick}
                />
              </>
            )}
          </g>
        );
      })}
    </g>
  );
});
