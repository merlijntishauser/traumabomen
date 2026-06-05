import React from "react";
import type { DecryptedEvent } from "../../hooks/useTreeData";
import { MarkerLabel } from "./MarkerLabel";
import type { MarkerContext } from "./markerHelpers";
import { PatternRings } from "./PatternRings";
import { SelectionRing } from "./SelectionRing";
import { MARKER_RADIUS } from "./timelineHelpers";

interface TraumaMarkersProps {
  ctx: MarkerContext;
  events: DecryptedEvent[];
}

function TraumaMarkersInner({ ctx, events }: TraumaMarkersProps) {
  const {
    orientation,
    persons,
    traumaColors,
    canvasStroke,
    hideTooltip,
    onTooltip,
    handleMarkerClick,
    dims,
    filterMode,
    showMarkerLabels,
    selectedEntityKeys,
    patternRings,
    t,
  } = ctx;

  return (
    <>
      {events.map((event) => {
        const year = Number.parseInt(event.approximate_date, 10);
        if (Number.isNaN(year)) return null;

        const { x: mx, y: my } = orientation.pointAt(year);
        const primaryPos = orientation.primaryPos(year);
        const linkedNames = event.person_ids
          .flatMap((pid) => {
            const name = persons.get(pid)?.name;
            return name ? [name] : [];
          })
          .join(", ");

        const isMarkerDimmed = dims?.dimmedEventIds.has(event.id);
        if (isMarkerDimmed && filterMode === "hide") return null;
        const isEntitySelected = selectedEntityKeys?.has(`trauma_event:${event.id}`);

        return (
          <g
            key={event.id}
            transform={orientation.markerTransform(primaryPos)}
            opacity={isMarkerDimmed ? 0.15 : undefined}
          >
            <circle
              cx={mx}
              cy={my}
              r={MARKER_RADIUS}
              fill={traumaColors[event.category]}
              stroke={canvasStroke}
              strokeWidth={1.5}
              className="tl-marker"
              onClick={(e) => handleMarkerClick("trauma_event", event.id, e)}
              onMouseEnter={(e) => {
                onTooltip({
                  visible: true,
                  x: e.clientX,
                  y: e.clientY,
                  lines: [
                    { text: event.title, bold: true },
                    { text: t(`trauma.category.${event.category}`) },
                    { text: orientation.dateText(year) },
                    { text: t("timeline.severity", { value: event.severity }) },
                    { text: linkedNames },
                  ],
                });
              }}
              onMouseLeave={hideTooltip}
            />
            <SelectionRing mx={mx} my={my} isSelected={isEntitySelected} />
            <PatternRings
              mx={mx}
              my={my}
              entityKey={`trauma_event:${event.id}`}
              patternRings={patternRings}
            />
            {showMarkerLabels && (
              <MarkerLabel
                orientation={orientation}
                year={year}
                labelKey={`t:${event.id}`}
                title={event.title}
              />
            )}
          </g>
        );
      })}
    </>
  );
}

export const TraumaMarkers = React.memo(TraumaMarkersInner);
