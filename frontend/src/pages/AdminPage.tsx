import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import { useLogout } from "../hooks/useLogout";
import { getAdminOverview, getAdminRetention, getAdminUsage } from "../lib/api";
import type { CohortRow, UsageBuckets } from "../types/api";
import "../styles/admin.css";
import "../components/tree/TreeCanvas.css";

const BUCKET_LABELS: { key: keyof UsageBuckets; label: string }[] = [
  { key: "zero", label: "0" },
  { key: "one_two", label: "1-2" },
  { key: "three_five", label: "3-5" },
  { key: "six_ten", label: "6-10" },
  { key: "eleven_twenty", label: "11-20" },
  { key: "twenty_plus", label: "20+" },
];

function retentionColor(pct: number): string {
  // Green intensity scales with retention percentage
  const alpha = Math.round((pct / 100) * 0.6 * 100) / 100;
  return `rgba(45, 138, 94, ${alpha})`;
}

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

export default function AdminPage() {
  const logout = useLogout();

  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: getAdminOverview,
  });

  const retention = useQuery({
    queryKey: ["admin", "retention"],
    queryFn: () => getAdminRetention(12),
  });

  const usage = useQuery({
    queryKey: ["admin", "usage"],
    queryFn: getAdminUsage,
  });

  const isLoading = overview.isLoading || retention.isLoading || usage.isLoading;
  const error = overview.error || retention.error || usage.error;

  // Find max weeks across all cohorts for table columns
  const maxWeeks = retention.data
    ? Math.max(0, ...retention.data.cohorts.map((c: CohortRow) => c.retention.length))
    : 0;

  return (
    <div className="admin-page">
      <div className="tree-toolbar">
        <span className="tree-toolbar__title">Admin</span>
        <div className="tree-toolbar__spacer" />
        <Link to="/trees" className="tree-toolbar__btn">
          Trees
        </Link>
        <ThemeToggle className="tree-toolbar__btn" />
        <button type="button" className="tree-toolbar__btn" onClick={logout}>
          Log out
        </button>
      </div>

      {isLoading && <div className="admin-loading">Loading...</div>}
      {error && <div className="admin-error">Failed to load stats</div>}

      {!isLoading && !error && (
        <div className="admin-content">
          {/* Overview cards */}
          <section>
            <div className="admin-section__title">Overview</div>
            <div className="admin-overview">
              <div className="admin-card">
                <div className="admin-card__label">Total users</div>
                <div className="admin-card__value">{overview.data?.total_users}</div>
                <div className="admin-card__sub">{overview.data?.verified_users} verified</div>
              </div>
              <div className="admin-card">
                <div className="admin-card__label">Signups (week)</div>
                <div className="admin-card__value">{overview.data?.signups.week}</div>
                <div className="admin-card__sub">{overview.data?.signups.day} today</div>
              </div>
              <div className="admin-card">
                <div className="admin-card__label">Signups (month)</div>
                <div className="admin-card__value">{overview.data?.signups.month}</div>
              </div>
              <div className="admin-card">
                <div className="admin-card__label">Active users</div>
                <div className="admin-card__value">{overview.data?.active_users.week}</div>
                <div className="admin-card__sub">
                  {overview.data?.active_users.day} today / {overview.data?.active_users.month}{" "}
                  month
                </div>
              </div>
            </div>
          </section>

          {/* Retention cohort table */}
          <section>
            <div className="admin-section__title">Retention (weekly cohorts)</div>
            <div className="admin-retention">
              {retention.data && retention.data.cohorts.length > 0 ? (
                <table className="admin-cohort-table">
                  <thead>
                    <tr>
                      <th>Cohort</th>
                      <th>Users</th>
                      {/* biome-ignore lint/suspicious/noArrayIndexKey: static week columns never reorder */}
                      {Array.from({ length: maxWeeks }, (_, i) => (
                        <th key={i}>W{i}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {retention.data.cohorts.map((cohort: CohortRow) => (
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
                <div className="admin-cohort-empty">No cohort data yet</div>
              )}
            </div>
          </section>

          {/* Usage depth */}
          <section>
            <div className="admin-section__title">Usage depth (entities per tree)</div>
            {usage.data && (
              <div className="admin-usage">
                <UsageChart title="Persons" buckets={usage.data.persons} />
                <UsageChart title="Relationships" buckets={usage.data.relationships} />
                <UsageChart title="Events" buckets={usage.data.events} />
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
