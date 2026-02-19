import React, { useCallback } from "react";
import { PartnerStatus } from "../../types/domain";
import type { TooltipLine } from "./timelineHelpers";
import { BAR_HEIGHT, ROW_HEIGHT } from "./timelineHelpers";

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
  // Place horizontal lines inside each partner's lane, just below the life bar
  const barOffset = (ROW_HEIGHT - BAR_HEIGHT) / 2 + BAR_HEIGHT + 3;
  const srcLineY = sourceY + barOffset;
  const tgtLineY = targetY + barOffset;

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
        const strokeColor = cssVar("--color-edge-partner");
        const dashArray = isDashed ? "6 3" : undefined;

        const tooltipLines: TooltipLine[] = [
          { text: `${sourceName} \u2014 ${targetName}`, bold: true },
          { text: `${statusLabel} ${yearRange}` },
        ];

        const showTooltip = (e: React.MouseEvent) => {
          onTooltip({ visible: true, x: e.clientX, y: e.clientY, lines: tooltipLines });
        };

        const srcLabel = t("timeline.partnerLabel", { status: statusLabel, name: targetName });
        const tgtLabel = t("timeline.partnerLabel", { status: statusLabel, name: sourceName });

        return (
          <g key={i}>
            {/* Vertical connector at period start */}
            <line
              x1={px1}
              x2={px1}
              y1={srcLineY}
              y2={tgtLineY}
              stroke={strokeColor}
              strokeWidth={1.5}
              strokeDasharray={dashArray}
              strokeOpacity={0.4}
            />
            {/* Horizontal line inside source partner's lane */}
            <line
              x1={px1}
              x2={px2}
              y1={srcLineY}
              y2={srcLineY}
              stroke={strokeColor}
              strokeWidth={2}
              strokeDasharray={dashArray}
            />
            {/* Label on source line */}
            <text
              x={px1 + 4}
              y={srcLineY - 3}
              fill={strokeColor}
              fontSize={8}
              className="tl-partner-label"
            >
              {srcLabel}
            </text>
            {/* Horizontal line inside target partner's lane */}
            <line
              x1={px1}
              x2={px2}
              y1={tgtLineY}
              y2={tgtLineY}
              stroke={strokeColor}
              strokeWidth={2}
              strokeDasharray={dashArray}
            />
            {/* Label on target line */}
            <text
              x={px1 + 4}
              y={tgtLineY - 3}
              fill={strokeColor}
              fontSize={8}
              className="tl-partner-label"
            >
              {tgtLabel}
            </text>
            {/* Invisible hover target on source line */}
            <line
              x1={px1}
              x2={px2}
              y1={srcLineY}
              y2={srcLineY}
              stroke="transparent"
              strokeWidth={10}
              style={{ cursor: "pointer" }}
              onMouseEnter={showTooltip}
              onMouseLeave={hideTooltip}
            />
            {/* Invisible hover target on target line */}
            <line
              x1={px1}
              x2={px2}
              y1={tgtLineY}
              y2={tgtLineY}
              stroke="transparent"
              strokeWidth={10}
              style={{ cursor: "pointer" }}
              onMouseEnter={showTooltip}
              onMouseLeave={hideTooltip}
            />
          </g>
        );
      })}
    </g>
  );
});
