import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DimSets, FilterMode } from "../../hooks/useTimelineFilters";
import type { TimelineSettings } from "../../hooks/useTimelineSettings";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedPattern,
  DecryptedPerson,
  DecryptedRelationship,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import { BranchDecoration } from "../tree/BranchDecoration";
import { TimelineAgeContent } from "./TimelineAgeContent";
import { TimelineTooltip } from "./TimelineTooltip";
import { TimelineYearsContent } from "./TimelineYearsContent";
import type { MarkerClickInfo, TimelineMode } from "./timelineHelpers";
import { INITIAL_TOOLTIP, type TooltipState } from "./timelineTooltipState";
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
  display?: Partial<TimelineSettings>;
  scrollMode?: boolean;
  onToggleScrollMode?: () => void;
}

const DEFAULT_DISPLAY: TimelineSettings = {
  showPartnerLines: true,
  showPartnerLabels: true,
  showClassifications: true,
  showGridlines: false,
  showMarkerLabels: true,
};

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
  display,
  scrollMode,
  onToggleScrollMode,
}: TimelineViewProps) {
  const resolvedDisplay: TimelineSettings = { ...DEFAULT_DISPLAY, ...display };
  const { t } = useTranslation();

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [tooltip, setTooltip] = useState<TooltipState>(INITIAL_TOOLTIP);
  const observerRef = useRef<ResizeObserver | null>(null);

  // Attach a ResizeObserver via a ref callback so the first measurement happens
  // synchronously when the container mounts (before paint), rather than setting
  // the initial size from a mount effect that renders an empty frame first.
  const setContainer = useCallback((container: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    if (!container) {
      observerRef.current = null;
      return;
    }
    setDimensions({ width: container.clientWidth, height: container.clientHeight });
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
    observerRef.current = observer;
  }, []);

  const { width, height } = dimensions;

  const onTooltip = useCallback((state: TooltipState) => {
    setTooltip(state);
  }, []);

  if (persons.size === 0) {
    return (
      <div className="timeline-container bg-gradient" ref={setContainer}>
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
    display: resolvedDisplay,
    scrollMode,
    onToggleScrollMode,
  };

  return (
    <div className="timeline-container bg-gradient" ref={setContainer}>
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
