import React from "react";
import type { DecryptedLifeEvent } from "../../hooks/useTreeData";
import { MarkerLabel } from "./MarkerLabel";
import type { MarkerContext } from "./markerHelpers";
import { PatternRings } from "./PatternRings";
import { SelectionRing } from "./SelectionRing";
import type { TooltipLine } from "./timelineHelpers";
import { MARKER_RADIUS } from "./timelineHelpers";

interface LifeEventMarkersProps {
  ctx: MarkerContext;
  lifeEvents: DecryptedLifeEvent[];
}

function LifeEventMarkersInner({ ctx, lifeEvents }: LifeEventMarkersProps) {
  const {
    orientation,
    persons,
    lifeEventColors,
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
      {lifeEvents.map((le) => {
        const year = Number.parseInt(le.approximate_date, 10);
        if (Number.isNaN(year)) return null;

        const { x: mx, y: my } = orientation.pointAt(year);
        const primaryPos = orientation.primaryPos(year);
        const diamondSize = MARKER_RADIUS * 0.9;
        const linkedNames = le.person_ids
          .flatMap((pid) => {
            const name = persons.get(pid)?.name;
            return name ? [name] : [];
          })
          .join(", ");

        const lines: TooltipLine[] = [
          { text: le.title, bold: true },
          { text: t(`lifeEvent.category.${le.category}`) },
          { text: orientation.dateText(year) },
        ];
        if (le.impact != null) {
          lines.push({ text: t("timeline.impact", { value: le.impact }) });
        }
        lines.push({ text: linkedNames });

        const isMarkerDimmed = dims?.dimmedLifeEventIds.has(le.id);
        if (isMarkerDimmed && filterMode === "hide") return null;
        const isEntitySelected = selectedEntityKeys?.has(`life_event:${le.id}`);

        return (
          <g
            key={le.id}
            transform={orientation.markerTransform(primaryPos)}
            opacity={isMarkerDimmed ? 0.15 : undefined}
          >
            <rect
              x={mx - diamondSize}
              y={my - diamondSize}
              width={diamondSize * 2}
              height={diamondSize * 2}
              transform={`rotate(45, ${mx}, ${my})`}
              fill={lifeEventColors[le.category]}
              stroke={canvasStroke}
              strokeWidth={1.5}
              className="tl-marker"
              onClick={(e) => handleMarkerClick("life_event", le.id, e)}
              onMouseEnter={(e) => {
                onTooltip({ visible: true, x: e.clientX, y: e.clientY, lines });
              }}
              onMouseLeave={hideTooltip}
            />
            <SelectionRing mx={mx} my={my} isSelected={isEntitySelected} />
            <PatternRings
              mx={mx}
              my={my}
              entityKey={`life_event:${le.id}`}
              patternRings={patternRings}
            />
            {showMarkerLabels && (
              <MarkerLabel
                orientation={orientation}
                year={year}
                labelKey={`l:${le.id}`}
                title={le.title}
              />
            )}
          </g>
        );
      })}
    </>
  );
}

export const LifeEventMarkers = React.memo(LifeEventMarkersInner);
