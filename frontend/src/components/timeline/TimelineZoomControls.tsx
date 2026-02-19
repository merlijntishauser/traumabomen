import { Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TimelineZoomActions } from "../../hooks/useTimelineZoom";

interface TimelineZoomControlsProps {
  actions: TimelineZoomActions;
}

export function TimelineZoomControls({ actions }: TimelineZoomControlsProps) {
  const { t } = useTranslation();

  return (
    <div className="tl-zoom-controls">
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
