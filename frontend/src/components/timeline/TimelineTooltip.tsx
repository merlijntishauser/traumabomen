import React from "react";
import type { TooltipLine } from "./timelineHelpers";

export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  lines: TooltipLine[];
}

export const INITIAL_TOOLTIP: TooltipState = {
  visible: false,
  x: 0,
  y: 0,
  lines: [],
};

interface TimelineTooltipProps {
  state: TooltipState;
}

export const TimelineTooltip = React.memo(function TimelineTooltip({
  state,
}: TimelineTooltipProps) {
  if (!state.visible) return null;

  return (
    <div
      className="timeline-tooltip"
      style={{
        display: "block",
        left: state.x + 12,
        top: state.y - 10,
      }}
    >
      {state.lines.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          <span style={line.bold ? { fontWeight: 600 } : undefined}>{line.text}</span>
        </React.Fragment>
      ))}
    </div>
  );
});
