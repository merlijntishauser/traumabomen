import React from "react";
import type { DecryptedClassification } from "../../hooks/useTreeData";
import { DiagnosisTriangle } from "./DiagnosisTriangle";
import type { MarkerContext } from "./markerHelpers";
import { StripLabel } from "./StripLabel";

interface ClassificationStripsProps {
  ctx: MarkerContext;
  classifications: DecryptedClassification[];
}

function ClassificationStripsInner({ ctx, classifications }: ClassificationStripsProps) {
  const {
    orientation,
    dims,
    filterMode,
    handleMarkerClick,
    onTooltip,
    hideTooltip,
    showMarkerLabels,
    classificationDiagnosedColor,
    classificationSuspectedColor,
    t,
  } = ctx;

  return (
    <>
      {classifications.map((cls, stripIdx) => {
        const clsColor =
          cls.status === "diagnosed" ? classificationDiagnosedColor : classificationSuspectedColor;
        const isMarkerDimmed = dims?.dimmedClassificationIds.has(cls.id);
        if (isMarkerDimmed && filterMode === "hide") return null;

        return (
          <g key={cls.id} opacity={isMarkerDimmed ? 0.15 : undefined}>
            {cls.periods.map((period, pi) => {
              const startPos = orientation.primaryPos(period.start_year);
              const endPos =
                period.end_year != null
                  ? orientation.primaryPos(period.end_year)
                  : orientation.fallbackEndPos;
              const rect = orientation.stripRect(startPos, endPos, stripIdx);

              const catLabel = t(`dsm.${cls.dsm_category}`);
              const subLabel = cls.dsm_subcategory ? t(`dsm.sub.${cls.dsm_subcategory}`) : null;
              const statusLabel = t(`classification.status.${cls.status}`);
              const yearRange = `${period.start_year}${period.end_year ? ` - ${period.end_year}` : " -"}`;
              const clsLabel = subLabel ?? catLabel;

              return (
                <React.Fragment key={`${cls.id}-p${pi}`}>
                  <rect
                    x={rect.x}
                    y={rect.y}
                    width={Math.max(0, rect.width)}
                    height={Math.max(0, rect.height)}
                    rx={1}
                    fill={clsColor}
                    opacity={0.8}
                    className="tl-marker"
                    onClick={(e) => handleMarkerClick("classification", cls.id, e)}
                    onMouseEnter={(e) => {
                      onTooltip({
                        visible: true,
                        x: e.clientX,
                        y: e.clientY,
                        lines: [
                          { text: subLabel ? `${catLabel} - ${subLabel}` : catLabel, bold: true },
                          { text: `${statusLabel} ${yearRange}` },
                        ],
                      });
                    }}
                    onMouseLeave={hideTooltip}
                  />
                  {showMarkerLabels && pi === 0 && (
                    <StripLabel
                      orientation={orientation}
                      startPos={startPos}
                      labelKey={`cs:${cls.id}`}
                      label={clsLabel}
                    />
                  )}
                </React.Fragment>
              );
            })}

            {cls.status === "diagnosed" && (
              <DiagnosisTriangle cls={cls} clsColor={clsColor} ctx={ctx} />
            )}
          </g>
        );
      })}
    </>
  );
}

export const ClassificationStrips = React.memo(ClassificationStripsInner);
