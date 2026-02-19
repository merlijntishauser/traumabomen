import { Hand, Maximize, Mouse, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TimelineZoomActions } from "../../hooks/useTimelineZoom";

interface TimelineZoomControlsProps {
  actions: TimelineZoomActions;
  scrollMode?: boolean;
  onToggleScrollMode?: () => void;
}

export function TimelineZoomControls({
  actions,
  scrollMode = false,
  onToggleScrollMode,
}: TimelineZoomControlsProps) {
  const { t } = useTranslation();

  const scrollModeLabel = scrollMode ? t("timeline.scrollMode") : t("timeline.zoomMode");

  return (
    <div className="tl-zoom-controls">
      {onToggleScrollMode && (
        <button
          type="button"
          className={`tl-zoom-controls__btn${scrollMode ? " tl-zoom-controls__btn--active" : ""}`}
          onClick={onToggleScrollMode}
          title={scrollModeLabel}
          aria-label={scrollModeLabel}
        >
          {scrollMode ? <Hand size={16} /> : <Mouse size={16} />}
        </button>
      )}
      <button
        type="button"
        className="tl-zoom-controls__btn"
        onClick={actions.zoomIn}
        title={t("timeline.zoomIn")}
        aria-label={t("timeline.zoomIn")}
      >
        <ZoomIn size={16} />
      </button>
      <button
        type="button"
        className="tl-zoom-controls__btn"
        onClick={actions.zoomOut}
        title={t("timeline.zoomOut")}
        aria-label={t("timeline.zoomOut")}
      >
        <ZoomOut size={16} />
      </button>
      <button
        type="button"
        className="tl-zoom-controls__btn"
        onClick={actions.resetZoom}
        title={t("timeline.fitToView")}
        aria-label={t("timeline.fitToView")}
      >
        <Maximize size={16} />
      </button>
    </div>
  );
}
