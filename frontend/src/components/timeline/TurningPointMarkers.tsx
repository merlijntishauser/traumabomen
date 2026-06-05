import React from "react";
import type { DecryptedTurningPoint } from "../../hooks/useTreeData";
import { MarkerLabel } from "./MarkerLabel";
import type { MarkerContext } from "./markerHelpers";
import { starPath } from "./markerHelpers";
import { PatternRings } from "./PatternRings";
import { SelectionRing } from "./SelectionRing";
import type { TooltipLine } from "./timelineHelpers";
import { MARKER_RADIUS } from "./timelineHelpers";

interface TurningPointMarkersProps {
  ctx: MarkerContext;
  turningPoints: DecryptedTurningPoint[];
}

function TurningPointMarkersInner({ ctx, turningPoints }: TurningPointMarkersProps) {
  const { turningPointColors } = ctx;
  if (!turningPointColors) return null;

  const {
    orientation,
    persons,
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
      {turningPoints.map((tp) => {
        const year = Number.parseInt(tp.approximate_date, 10);
        if (Number.isNaN(year)) return null;

        const { x: mx, y: my } = orientation.pointAt(year);
        const primaryPos = orientation.primaryPos(year);
        const r = MARKER_RADIUS;
        const path = starPath(mx, my, r);

        const linkedNames = tp.person_ids
          .flatMap((pid) => {
            const name = persons.get(pid)?.name;
            return name ? [name] : [];
          })
          .join(", ");

        const lines: TooltipLine[] = [
          { text: tp.title, bold: true },
          { text: t(`turningPoint.category.${tp.category}`) },
          { text: orientation.dateText(year) },
        ];
        if (tp.significance != null) {
          lines.push({ text: t("timeline.significance", { value: tp.significance }) });
        }
        lines.push({ text: linkedNames });

        const isMarkerDimmed = dims?.dimmedTurningPointIds.has(tp.id);
        if (isMarkerDimmed && filterMode === "hide") return null;
        const isEntitySelected = selectedEntityKeys?.has(`turning_point:${tp.id}`);

        return (
          <g
            key={tp.id}
            transform={orientation.markerTransform(primaryPos)}
            opacity={isMarkerDimmed ? 0.15 : undefined}
          >
            <path
              d={path}
              fill={turningPointColors[tp.category]}
              stroke={canvasStroke}
              strokeWidth={1.5}
              className="tl-marker tl-marker--star"
              onClick={(e) => handleMarkerClick("turning_point", tp.id, e)}
              onMouseEnter={(e) => {
                onTooltip({ visible: true, x: e.clientX, y: e.clientY, lines });
              }}
              onMouseLeave={hideTooltip}
            />
            <SelectionRing mx={mx} my={my} isSelected={isEntitySelected} />
            <PatternRings
              mx={mx}
              my={my}
              entityKey={`turning_point:${tp.id}`}
              patternRings={patternRings}
            />
            {showMarkerLabels && (
              <MarkerLabel
                orientation={orientation}
                year={year}
                labelKey={`tp:${tp.id}`}
                title={tp.title}
              />
            )}
          </g>
        );
      })}
    </>
  );
}

export const TurningPointMarkers = React.memo(TurningPointMarkersInner);
