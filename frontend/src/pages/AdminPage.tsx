import { useQuery } from "@tanstack/react-query";
import * as d3 from "d3";
import { House, LogOut } from "lucide-react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ThemeToggle } from "../components/ThemeToggle";
import { useLogout } from "../hooks/useLogout";
import {
  getAdminActivity,
  getAdminFunnel,
  getAdminGrowth,
  getAdminOverview,
  getAdminRetention,
  getAdminUsage,
  getAdminUsers,
} from "../lib/api";
import type { ActivityCell, CohortRow, GrowthPoint, UsageBuckets, UserRow } from "../types/api";
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

const FUNNEL_STEP_KEYS: { key: string; i18nKey: string }[] = [
  { key: "registered", i18nKey: "admin.funnel.registered" },
  { key: "verified", i18nKey: "admin.funnel.verified" },
  { key: "created_tree", i18nKey: "admin.funnel.createdTree" },
  { key: "added_person", i18nKey: "admin.funnel.addedPerson" },
  { key: "added_relationship", i18nKey: "admin.funnel.addedRelationship" },
  { key: "added_event", i18nKey: "admin.funnel.addedEvent" },
];

const DAY_I18N_KEYS = [
  "admin.day.mon",
  "admin.day.tue",
  "admin.day.wed",
  "admin.day.thu",
  "admin.day.fri",
  "admin.day.sat",
  "admin.day.sun",
];

function retentionColor(pct: number): string {
  const alpha = Math.round((pct / 100) * 0.6 * 100) / 100;
  return `rgba(45, 138, 94, ${alpha})`;
}

function heatmapColor(count: number, max: number): string {
  if (count === 0) return "transparent";
  const alpha = Math.round((count / max) * 0.7 * 100) / 100;
  return `rgba(45, 138, 94, ${Math.max(0.08, alpha)})`;
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

function GrowthChart({ points }: { points: GrowthPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || points.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 16, right: 16, bottom: 28, left: 44 };
    const width = svgRef.current.clientWidth;
    const height = 200;

    const data = points.map((p) => ({ date: new Date(p.date), total: p.total }));

    const x = d3
      .scaleTime()
      .domain(d3.extent(data, (d) => d.date) as [Date, Date])
      .range([margin.left, width - margin.right]);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.total) ?? 1])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const line = d3
      .line<(typeof data)[0]>()
      .x((d) => x(d.date))
      .y((d) => y(d.total))
      .curve(d3.curveMonotoneX);

    const area = d3
      .area<(typeof data)[0]>()
      .x((d) => x(d.date))
      .y0(height - margin.bottom)
      .y1((d) => y(d.total))
      .curve(d3.curveMonotoneX);

    // Area fill
    svg.append("path").datum(data).attr("fill", "rgba(45, 138, 94, 0.12)").attr("d", area);

    // Line
    svg
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "var(--color-accent)")
      .attr("stroke-width", 2)
      .attr("d", line);

    // X axis
    svg
      .append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(Math.min(data.length, 6))
          .tickFormat(d3.timeFormat("%b %d") as (d: Date | d3.NumberValue) => string),
      )
      .call((g) => g.select(".domain").attr("stroke", "var(--color-border-primary)"))
      .call((g) =>
        g.selectAll(".tick text").attr("fill", "var(--color-text-muted)").attr("font-size", "11"),
      )
      .call((g) => g.selectAll(".tick line").attr("stroke", "var(--color-border-secondary)"));

    // Y axis
    svg
      .append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(4))
      .call((g) => g.select(".domain").attr("stroke", "var(--color-border-primary)"))
      .call((g) =>
        g.selectAll(".tick text").attr("fill", "var(--color-text-muted)").attr("font-size", "11"),
      )
      .call((g) => g.selectAll(".tick line").attr("stroke", "var(--color-border-secondary)"));
  }, [points]);

  return <svg ref={svgRef} className="admin-growth-svg" />;
}

export default function AdminPage() {
  const { t, i18n } = useTranslation();
  const logout = useLogout();

  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: getAdminOverview });
  const funnel = useQuery({ queryKey: ["admin", "funnel"], queryFn: getAdminFunnel });
  const growth = useQuery({ queryKey: ["admin", "growth"], queryFn: getAdminGrowth });
  const activity = useQuery({ queryKey: ["admin", "activity"], queryFn: getAdminActivity });
  const retention = useQuery({
    queryKey: ["admin", "retention"],
    queryFn: () => getAdminRetention(12),
  });
  const usage = useQuery({ queryKey: ["admin", "usage"], queryFn: getAdminUsage });
  const users = useQuery({ queryKey: ["admin", "users"], queryFn: getAdminUsers });

  const isLoading =
    overview.isLoading ||
    funnel.isLoading ||
    growth.isLoading ||
    activity.isLoading ||
    retention.isLoading ||
    usage.isLoading ||
    users.isLoading;
  const error =
    overview.error ||
    funnel.error ||
    growth.error ||
    activity.error ||
    retention.error ||
    usage.error ||
    users.error;

  const maxWeeks = retention.data
    ? Math.max(0, ...retention.data.cohorts.map((c: CohortRow) => c.retention.length))
    : 0;

  // Build heatmap grid from activity cells
  const activityMax = activity.data
    ? Math.max(1, ...activity.data.cells.map((c: ActivityCell) => c.count))
    : 1;
  const activityGrid = new Map<string, number>();
  if (activity.data) {
    for (const cell of activity.data.cells) {
      activityGrid.set(`${cell.day}-${cell.hour}`, cell.count);
    }
  }

  // Funnel max for bar widths
  const funnelMax = funnel.data?.registered ?? 1;

  const dayLabels = DAY_I18N_KEYS.map((key) => t(key));

  return (
    <div className="admin-page">
      <div className="tree-toolbar">
        <span className="tree-toolbar__title">{t("admin.title")}</span>
        <div className="tree-toolbar__spacer" />

        <div className="tree-toolbar__group">
          <Link to="/trees" className="tree-toolbar__icon-btn" aria-label={t("nav.trees")}>
            <House size={16} />
          </Link>
        </div>

        <div className="tree-toolbar__separator" />

        <div className="tree-toolbar__group">
          <ThemeToggle className="tree-toolbar__icon-btn" />
          <button
            type="button"
            className="tree-toolbar__icon-btn"
            onClick={logout}
            aria-label={t("nav.logout")}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {isLoading && <div className="admin-loading">{t("common.loading")}</div>}
      {error && <div className="admin-error">{t("admin.loadError")}</div>}

      {!isLoading && !error && (
        <div className="admin-content">
          {/* Overview cards */}
          <section>
            <div className="admin-section__title">{t("admin.overview")}</div>
            <div className="admin-overview">
              <div className="admin-card">
                <div className="admin-card__label">{t("admin.totalUsers")}</div>
                <div className="admin-card__value">{overview.data?.total_users}</div>
                <div className="admin-card__sub">
                  {overview.data?.verified_users} {t("admin.verified")}
                </div>
              </div>
              <div className="admin-card">
                <div className="admin-card__label">{t("admin.signupsWeek")}</div>
                <div className="admin-card__value">{overview.data?.signups.week}</div>
                <div className="admin-card__sub">
                  {overview.data?.signups.day} {t("admin.today")}
                </div>
              </div>
              <div className="admin-card">
                <div className="admin-card__label">{t("admin.signupsMonth")}</div>
                <div className="admin-card__value">{overview.data?.signups.month}</div>
              </div>
              <div className="admin-card">
                <div className="admin-card__label">{t("admin.activeUsers")}</div>
                <div className="admin-card__value">{overview.data?.active_users.week}</div>
                <div className="admin-card__sub">
                  {t("admin.activeUsersSub", {
                    day: overview.data?.active_users.day,
                    month: overview.data?.active_users.month,
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Signup funnel */}
          {funnel.data && (
            <section>
              <div className="admin-section__title">{t("admin.signupFunnel")}</div>
              <div className="admin-funnel">
                {FUNNEL_STEP_KEYS.map((step) => {
                  const count = funnel.data[step.key as keyof typeof funnel.data] as number;
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
          )}

          {/* Growth chart */}
          {growth.data && growth.data.points.length > 0 && (
            <section>
              <div className="admin-section__title">{t("admin.userGrowth")}</div>
              <GrowthChart points={growth.data.points} />
            </section>
          )}

          {/* Activity heatmap */}
          {activity.data && (
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
          )}

          {/* Retention cohort table */}
          <section>
            <div className="admin-section__title">{t("admin.retention")}</div>
            <div className="admin-retention">
              {retention.data && retention.data.cohorts.length > 0 ? (
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
                <div className="admin-cohort-empty">{t("admin.noCohortData")}</div>
              )}
            </div>
          </section>

          {/* Usage depth */}
          <section>
            <div className="admin-section__title">{t("admin.usageDepth")}</div>
            {usage.data && (
              <div className="admin-usage">
                <UsageChart title={t("admin.persons")} buckets={usage.data.persons} />
                <UsageChart title={t("admin.relationships")} buckets={usage.data.relationships} />
                <UsageChart title={t("admin.events")} buckets={usage.data.events} />
              </div>
            )}
          </section>

          {/* User list */}
          {users.data && (
            <section>
              <div className="admin-section__title">{t("admin.userList")}</div>
              <div className="admin-users">
                <table className="admin-users-table">
                  <thead>
                    <tr>
                      <th>{t("admin.email")}</th>
                      <th>{t("admin.signedUp")}</th>
                      <th>{t("admin.lastLogin")}</th>
                      <th>{t("admin.emailVerified")}</th>
                      <th>{t("admin.trees")}</th>
                      <th>{t("admin.persons")}</th>
                      <th>{t("admin.rels")}</th>
                      <th>{t("admin.events")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.data.users.map((user: UserRow) => (
                      <tr key={user.id}>
                        <td className="admin-users-table__email">{user.email}</td>
                        <td>{formatDate(user.created_at, i18n.language)}</td>
                        <td>
                          {user.last_login ? formatDate(user.last_login, i18n.language) : "--"}
                        </td>
                        <td>{user.email_verified ? t("admin.yes") : t("admin.no")}</td>
                        <td>{user.tree_count}</td>
                        <td>{user.person_count}</td>
                        <td>{user.relationship_count}</td>
                        <td>{user.event_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
