import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DimSets, FilterMode } from "../../hooks/useTimelineFilters";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import { BranchDecoration } from "../BranchDecoration";
import type { MarkerClickInfo, TimelineMode } from "./PersonLane";
import { TimelineAgeContent } from "./TimelineAgeContent";
import { INITIAL_TOOLTIP, TimelineTooltip, type TooltipState } from "./TimelineTooltip";
import { TimelineYearsContent } from "./TimelineYearsContent";
import "./TimelineView.css";

export type LayoutMode = "years" | "age";

interface TimelineViewProps {
  persons: Map<string, DecryptedPerson>;
  relationships: Map<string, DecryptedRelationship>;
  events: Map<string, DecryptedEvent>;
  lifeEvents: Map<string, DecryptedLifeEvent>;
  turningPoints?: Map<string, DecryptedTurningPoint>;
  classifications: Map<string, DecryptedClassification>;
  mode?: TimelineMode;
  selectedPersonId?: string | null;
  dims?: DimSets;
  filterMode?: FilterMode;
  layoutMode?: LayoutMode;
  onSelectPerson?: (personId: string | null) => void;
  onClickMarker?: (info: MarkerClickInfo) => void;
  onClickPartnerLine?: (relationshipId: string) => void;
  patterns?: Map<string, DecryptedPattern>;
  visiblePatternIds?: Set<string>;
  selectedEntityKeys?: Set<string>;
  hoveredPatternId?: string | null;
  onToggleEntitySelect?: (key: string) => void;
  onPatternHover?: (patternId: string | null) => void;
  onPatternClick?: (patternId: string) => void;
  showPartnerLines?: boolean;
  showPartnerLabels?: boolean;
  showClassifications?: boolean;
  showGridlines?: boolean;
  showMarkerLabels?: boolean;
  scrollMode?: boolean;
  onToggleScrollMode?: () => void;
}

export function TimelineView({
  persons,
  relationships,
  events,
  lifeEvents,
  turningPoints,
  classifications,
  mode = "explore",
  selectedPersonId = null,
  dims,
  filterMode = "dim",
  layoutMode = "years",
  onSelectPerson,
  onClickMarker,
  onClickPartnerLine,
  patterns,
  visiblePatternIds,
  selectedEntityKeys,
  hoveredPatternId,
  onToggleEntitySelect,
  onPatternHover,
  onPatternClick,
  showPartnerLines = true,
  showPartnerLabels = true,
  showClassifications = true,
  showGridlines = false,
  showMarkerLabels = true,
  scrollMode,
  onToggleScrollMode,
}: TimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [tooltip, setTooltip] = useState<TooltipState>(INITIAL_TOOLTIP);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const { width, height } = dimensions;

  const onTooltip = useCallback((state: TooltipState) => {
    setTooltip(state);
  }, []);

  if (persons.size === 0) {
    return (
      <div className="timeline-container bg-gradient" ref={containerRef}>
        <BranchDecoration />
        <div className="timeline-empty">{t("timeline.noData")}</div>
      </div>
    );
  }

  const contentProps = {
    persons,
    relationships,
    events,
    lifeEvents,
    turningPoints,
    classifications,
    width,
    height,
    mode,
    selectedPersonId,
    dims,
    filterMode,
    onSelectPerson,
    onClickMarker,
    onClickPartnerLine,
    onTooltip,
    patterns,
    visiblePatternIds,
    selectedEntityKeys,
    hoveredPatternId,
    onToggleEntitySelect,
    onPatternHover,
    onPatternClick,
    showPartnerLines,
    showPartnerLabels,
    showClassifications,
    showGridlines,
    showMarkerLabels,
    scrollMode,
    onToggleScrollMode,
  };

  return (
    <div className="timeline-container bg-gradient" ref={containerRef}>
      <BranchDecoration />
      {layoutMode === "years" ? (
        <TimelineYearsContent {...contentProps} />
      ) : (
        <TimelineAgeContent {...contentProps} />
      )}
      <TimelineTooltip state={tooltip} />
    </div>
  );
}
