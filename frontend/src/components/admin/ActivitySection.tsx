import { useTranslation } from "react-i18next";
import type { ActivityStats } from "../../types/api";

const DAY_I18N_KEYS = [
  "admin.day.mon",
  "admin.day.tue",
  "admin.day.wed",
  "admin.day.thu",
  "admin.day.fri",
  "admin.day.sat",
  "admin.day.sun",
];

function heatmapColor(count: number, max: number): string {
  if (count === 0) return "transparent";
  const alpha = Math.round((count / max) * 0.7 * 100) / 100;
  return `rgba(45, 138, 94, ${Math.max(0.08, alpha)})`;
}

export function ActivitySection({ data }: { data: ActivityStats }) {
  const { t } = useTranslation();

  const activityMax = Math.max(1, ...data.cells.map((c) => c.count));
  const activityGrid = new Map<string, number>();
  for (const cell of data.cells) {
    activityGrid.set(`${cell.day}-${cell.hour}`, cell.count);
  }

  const dayLabels = DAY_I18N_KEYS.map((key) => t(key));

  return (
    <section>
      <div className="admin-section__title">{t("admin.loginActivity")}</div>
      <div className="admin-heatmap">
        <div className="admin-heatmap__corner" />
        {Array.from({ length: 24 }, (_, h) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static hour columns
          <div key={h} className="admin-heatmap__hour">
            {h}
          </div>
        ))}
        {dayLabels.map((dayLabel, dayIdx) => (
          <div key={dayLabel} className="admin-heatmap__row">
            <div className="admin-heatmap__day">{dayLabel}</div>
            {Array.from({ length: 24 }, (_, h) => {
              const count = activityGrid.get(`${dayIdx}-${h}`) ?? 0;
              return (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: static hour cells
                  key={h}
                  className="admin-heatmap__cell"
                  style={{ backgroundColor: heatmapColor(count, activityMax) }}
                  title={t("admin.heatmapTooltip", {
                    day: dayLabel,
                    hour: h,
                    count,
                  })}
                />
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
