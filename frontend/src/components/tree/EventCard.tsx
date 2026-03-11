import type { CSSProperties } from "react";

const SEVERITY_DOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Mini-bar showing severity/impact as 10 small filled/empty blocks. */
export function SeverityBar({ value, color }: { value: number; color: string }) {
  const clamped = Math.max(0, Math.min(10, value));
  return (
    <div className="detail-panel__severity-bar" role="img" aria-label={`${clamped}/10`}>
      {SEVERITY_DOTS.map((dot) => (
        <span
          key={`sev-${dot}`}
          className="detail-panel__severity-dot"
          style={{
            backgroundColor: dot < clamped ? color : "var(--color-border-primary)",
            opacity: dot < clamped ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

interface EventCardProps {
  title: string;
  approximateDate?: string;
  categoryLabel: string;
  color: string;
  barValue?: number | null;
  dotClassName?: string;
  dotStyle?: CSSProperties;
  onClick: () => void;
}

/** Shared card component used in TraumaEventsTab, LifeEventsTab, and TurningPointsTab. */
export function EventCard({
  title,
  approximateDate,
  categoryLabel,
  color,
  barValue,
  dotClassName = "detail-panel__event-card-dot",
  dotStyle,
  onClick,
}: EventCardProps) {
  return (
    <button type="button" className="detail-panel__event-card" onClick={onClick}>
      <div className="detail-panel__event-card-row">
        <span className={dotClassName} style={{ backgroundColor: color, ...dotStyle }} />
        <span className="detail-panel__event-card-title">{title}</span>
        {approximateDate && (
          <span className="detail-panel__event-card-date">{approximateDate}</span>
        )}
      </div>
      <div className="detail-panel__event-card-meta">
        <span
          className="detail-panel__category-pill"
          style={{ backgroundColor: `${color}26`, color }}
        >
          {categoryLabel}
        </span>
        {barValue != null && barValue > 0 && <SeverityBar value={barValue} color={color} />}
      </div>
    </button>
  );
}
