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
  showLabels?: boolean;
  zoomK?: number;
}

const BAR_OFFSET_X = BAR_HEIGHT / 2 + 2;
const LABEL_OFFSET = 8;

function computeBarPositions(
  sourceX: number | null,
  targetX: number | null,
  sourceLaneWidth: number,
  targetLaneWidth: number,
) {
  const srcIsLeft = sourceX != null && targetX != null && sourceX < targetX;
  const bothVisible = sourceX != null && targetX != null;

  const srcBarX =
    sourceX != null
      ? srcIsLeft
        ? sourceX + sourceLaneWidth - BAR_OFFSET_X
        : sourceX + BAR_OFFSET_X
      : null;
  const tgtBarX =
    targetX != null
      ? srcIsLeft
        ? targetX + BAR_OFFSET_X
        : targetX + targetLaneWidth - BAR_OFFSET_X
      : null;

  const srcLabelOffsetX = bothVisible ? (srcIsLeft ? -LABEL_OFFSET : LABEL_OFFSET) : -LABEL_OFFSET;
  const tgtLabelOffsetX = bothVisible ? (srcIsLeft ? LABEL_OFFSET : -LABEL_OFFSET) : -LABEL_OFFSET;

  return { srcBarX, tgtBarX, srcLabelOffsetX, tgtLabelOffsetX };
}

interface VerticalBarProps {
  barX: number;
  y1: number;
  y2: number;
  strokeColor: string;
  dashArray: string | undefined;
  label: string;
  labelOffsetX: number;
  labelTransform: (x: number, py: number) => string;
  showLabels: boolean;
  showTooltip: (e: React.MouseEvent) => void;
  hideTooltip: () => void;
  onClick?: () => void;
}

function VerticalBar({
  barX,
  y1,
  y2,
  strokeColor,
  dashArray,
  label,
  labelOffsetX,
  labelTransform,
  showLabels,
  showTooltip,
  hideTooltip,
  onClick,
}: VerticalBarProps) {
  const midY = (y1 + y2) / 2;
  const labelX = barX + labelOffsetX;
  return (
    <>
      <line
        x1={barX}
        x2={barX}
        y1={y1}
        y2={y2}
        stroke={strokeColor}
        strokeWidth={2}
        strokeDasharray={dashArray}
      />
      {showLabels && (
        <text
          x={labelX}
          y={midY}
          fill={strokeColor}
          fontSize={10}
          textAnchor="middle"
          className="tl-partner-label"
          transform={labelTransform(labelX, midY)}
        >
          {label}
        </text>
      )}
      <line
        x1={barX}
        x2={barX}
        y1={y1}
        y2={y2}
        stroke="transparent"
        strokeWidth={10}
        style={{ cursor: "pointer" }}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onClick={onClick}
      />
    </>
  );
}

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
  showLabels = true,
  zoomK = 1,
}: AgePartnerLineProps) {
  const hideTooltip = useCallback(() => {
    onTooltip({ visible: false, x: 0, y: 0, lines: [] });
  }, [onTooltip]);

  // Counter-scale: neutralize the parent zoom group's vertical scale on labels
  const inv = 1 / zoomK;
  const labelTransform = (x: number, py: number) => {
    const rotate = `rotate(-90, ${x}, ${py})`;
    if (zoomK === 1) return rotate;
    return `translate(0,${py}) scale(1,${inv}) translate(0,${-py}) ${rotate}`;
  };

  if (sourceX == null && targetX == null) return null;

  const {
    srcBarX: effectiveSrcBarX,
    tgtBarX: effectiveTgtBarX,
    srcLabelOffsetX,
    tgtLabelOffsetX,
  } = computeBarPositions(sourceX, targetX, sourceLaneWidth, targetLaneWidth);

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
              <VerticalBar
                barX={effectiveSrcBarX}
                y1={srcY1}
                y2={srcY2}
                strokeColor={strokeColor}
                dashArray={dashArray}
                label={srcLabel}
                labelOffsetX={srcLabelOffsetX}
                labelTransform={labelTransform}
                showLabels={showLabels}
                showTooltip={showTooltip}
                hideTooltip={hideTooltip}
                onClick={onClick}
              />
            )}
            {/* Target partner vertical bar + label */}
            {effectiveTgtBarX != null && (
              <VerticalBar
                barX={effectiveTgtBarX}
                y1={tgtY1}
                y2={tgtY2}
                strokeColor={strokeColor}
                dashArray={dashArray}
                label={tgtLabel}
                labelOffsetX={tgtLabelOffsetX}
                labelTransform={labelTransform}
                showLabels={showLabels}
                showTooltip={showTooltip}
                hideTooltip={hideTooltip}
                onClick={onClick}
              />
            )}
          </g>
        );
      })}
    </g>
  );
});
