import type { CSSProperties } from "react";

/** Mini-bar showing severity/impact as 10 small filled/empty blocks. */
export function SeverityBar({ value, color }: { value: number; color: string }) {
  const clamped = Math.max(0, Math.min(10, value));
  return (
    <div className="detail-panel__severity-bar" role="img" aria-label={`${clamped}/10`}>
      {Array.from({ length: 10 }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-size static array of 10 dots
          key={`sev-${i}`}
          className="detail-panel__severity-dot"
          style={{
            backgroundColor: i < clamped ? color : "var(--color-border-primary)",
            opacity: i < clamped ? 1 : 0.3,
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
