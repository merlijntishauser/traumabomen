import { useTranslation } from "react-i18next";
import type { FunnelStats } from "../../types/api";

const FUNNEL_STEP_KEYS: { key: string; i18nKey: string }[] = [
  { key: "registered", i18nKey: "admin.funnel.registered" },
  { key: "verified", i18nKey: "admin.funnel.verified" },
  { key: "created_tree", i18nKey: "admin.funnel.createdTree" },
  { key: "added_person", i18nKey: "admin.funnel.addedPerson" },
  { key: "added_relationship", i18nKey: "admin.funnel.addedRelationship" },
  { key: "added_event", i18nKey: "admin.funnel.addedEvent" },
];

export function FunnelSection({ data }: { data: FunnelStats }) {
  const { t } = useTranslation();
  const funnelMax = data.registered ?? 1;

  return (
    <section>
      <div className="admin-section__title">{t("admin.signupFunnel")}</div>
      <div className="admin-funnel">
        {FUNNEL_STEP_KEYS.map((step) => {
          const count = data[step.key as keyof FunnelStats] as number;
          const pct = funnelMax > 0 ? Math.round((count / funnelMax) * 100) : 0;
          return (
            <div key={step.key} className="admin-funnel-row">
              <span className="admin-funnel-label">{t(step.i18nKey)}</span>
              <div className="admin-bar-track">
                <div
                  className="admin-bar-fill"
                  style={{ width: `${(count / funnelMax) * 100}%` }}
                />
              </div>
              <span className="admin-funnel-count">
                {count} ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
