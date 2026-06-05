import React from "react";
import type { TooltipState } from "./timelineTooltipState";

export type { TooltipState } from "./timelineTooltipState";

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
      {state.lines.map((line, idx) => (
        <React.Fragment key={line.text}>
          {idx > 0 && <br />}
          <span style={line.bold ? { fontWeight: 600 } : undefined}>{line.text}</span>
        </React.Fragment>
      ))}
    </div>
  );
});
