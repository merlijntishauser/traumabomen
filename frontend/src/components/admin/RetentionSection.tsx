import { useTranslation } from "react-i18next";
import type { CohortRow, RetentionStats } from "../../types/api";

function retentionColor(pct: number): string {
  const alpha = Math.round((pct / 100) * 0.6 * 100) / 100;
  return `rgba(45, 138, 94, ${alpha})`;
}

export function RetentionSection({ data }: { data: RetentionStats | undefined }) {
  const { t } = useTranslation();

  const maxWeeks = data
    ? Math.max(0, ...data.cohorts.map((c: CohortRow) => c.retention.length))
    : 0;

  return (
    <section>
      <div className="admin-section__title">{t("admin.retention")}</div>
      <div className="admin-retention">
        {data && data.cohorts.length > 0 ? (
          <table className="admin-cohort-table">
            <thead>
              <tr>
                <th>{t("admin.cohort")}</th>
                <th>{t("admin.users")}</th>
                {Array.from({ length: maxWeeks }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static week columns never reorder
                  <th key={`w${i}`}>W{i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((cohort: CohortRow) => (
                <tr key={cohort.week}>
                  <td>{cohort.week}</td>
                  <td>{cohort.signup_count}</td>
                  {Array.from({ length: maxWeeks }, (_, i) => {
                    const pct = cohort.retention[i];
                    return (
                      <td
                        // biome-ignore lint/suspicious/noArrayIndexKey: static week columns
                        key={i}
                        style={
                          pct !== undefined
                            ? { backgroundColor: retentionColor(pct) }
                            : undefined
                        }
                      >
                        {pct !== undefined ? `${pct}%` : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="admin-cohort-empty">{t("admin.noCohortData")}</div>
        )}
      </div>
    </section>
  );
}
