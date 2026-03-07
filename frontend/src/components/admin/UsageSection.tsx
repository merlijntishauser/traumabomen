import { useTranslation } from "react-i18next";
import type { UsageBuckets, UsageStats } from "../../types/api";

const BUCKET_LABELS: { key: keyof UsageBuckets; label: string }[] = [
  { key: "zero", label: "0" },
  { key: "one_two", label: "1-2" },
  { key: "three_five", label: "3-5" },
  { key: "six_ten", label: "6-10" },
  { key: "eleven_twenty", label: "11-20" },
  { key: "twenty_plus", label: "20+" },
];

function UsageChart({ title, buckets }: { title: string; buckets: UsageBuckets }) {
  const max = Math.max(1, ...BUCKET_LABELS.map((b) => buckets[b.key]));
  return (
    <div className="admin-usage-chart">
      <div className="admin-usage-chart__title">{title}</div>
      {BUCKET_LABELS.map((b) => (
        <div key={b.key} className="admin-bar-row">
          <span className="admin-bar-label">{b.label}</span>
          <div className="admin-bar-track">
            <div className="admin-bar-fill" style={{ width: `${(buckets[b.key] / max) * 100}%` }} />
          </div>
          <span className="admin-bar-count">{buckets[b.key]}</span>
        </div>
      ))}
    </div>
  );
}

export function UsageSection({ data }: { data: UsageStats }) {
  const { t } = useTranslation();

  return (
    <section>
      <div className="admin-section__title">{t("admin.usageDepth")}</div>
      <div className="admin-usage">
        <UsageChart title={t("admin.persons")} buckets={data.persons} />
        <UsageChart title={t("admin.relationships")} buckets={data.relationships} />
        <UsageChart title={t("admin.events")} buckets={data.events} />
      </div>
    </section>
  );
}
