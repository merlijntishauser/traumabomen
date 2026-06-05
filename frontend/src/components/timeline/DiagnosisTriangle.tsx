import type { DecryptedClassification } from "../../hooks/useTreeData";
import { DiagnosisLabel } from "./DiagnosisLabel";
import type { MarkerContext } from "./markerHelpers";
import { trianglePath } from "./markerHelpers";
import { PatternRings } from "./PatternRings";
import { SelectionRing } from "./SelectionRing";
import { MARKER_RADIUS } from "./timelineHelpers";

export function DiagnosisTriangle({
  cls,
  clsColor,
  ctx,
}: {
  cls: DecryptedClassification;
  clsColor: string;
  ctx: MarkerContext;
}) {
  const {
    orientation,
    canvasStroke,
    handleMarkerClick,
    onTooltip,
    hideTooltip,
    showMarkerLabels,
    selectedEntityKeys,
    patternRings,
    t,
  } = ctx;

  if (cls.diagnosis_year == null) return null;

  const { x: mx, y: my } = orientation.pointAt(cls.diagnosis_year);
  const triSize = MARKER_RADIUS * 0.85;
  const triP = trianglePath(mx, my, triSize);
  const primaryPos = orientation.primaryPos(cls.diagnosis_year);

  const catLabel = t(`dsm.${cls.dsm_category}`);
  const subLabel = cls.dsm_subcategory ? t(`dsm.sub.${cls.dsm_subcategory}`) : null;
  const isClsSelected = selectedEntityKeys?.has(`classification:${cls.id}`);
  const triLabel = subLabel ?? catLabel;

  return (
    <g transform={orientation.markerTransform(primaryPos)}>
      <path
        d={triP}
        fill={clsColor}
        stroke={canvasStroke}
        strokeWidth={1.5}
        className="tl-marker"
        onClick={(e) => handleMarkerClick("classification", cls.id, e)}
        onMouseEnter={(e) => {
          onTooltip({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            lines: [
              {
                text: subLabel ? `${catLabel} - ${subLabel}` : catLabel,
                bold: true,
              },
              {
                text: `${t("classification.status.diagnosed")} (${cls.diagnosis_year})`,
              },
            ],
          });
        }}
        onMouseLeave={hideTooltip}
      />
      <SelectionRing mx={mx} my={my} isSelected={isClsSelected} />
      <PatternRings
        mx={mx}
        my={my}
        entityKey={`classification:${cls.id}`}
        patternRings={patternRings}
      />
      {showMarkerLabels && cls.diagnosis_year !== cls.periods[0]?.start_year && (
        <DiagnosisLabel
          orientation={orientation}
          diagnosisYear={cls.diagnosis_year}
          labelKey={`ct:${cls.id}`}
          label={triLabel}
        />
      )}
    </g>
  );
}
