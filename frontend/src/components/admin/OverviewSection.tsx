import { useTranslation } from "react-i18next";
import type { OverviewStats } from "../../types/api";

export function OverviewSection({ data }: { data: OverviewStats | undefined }) {
  const { t } = useTranslation();

  return (
    <section>
      <div className="admin-section__title">{t("admin.overview")}</div>
      <div className="admin-overview">
        <div className="admin-card">
          <div className="admin-card__label">{t("admin.totalUsers")}</div>
          <div className="admin-card__value">{data?.total_users}</div>
          <div className="admin-card__sub">
            {data?.verified_users} {t("admin.verified")}
          </div>
        </div>
        <div className="admin-card">
          <div className="admin-card__label">{t("admin.signupsWeek")}</div>
          <div className="admin-card__value">{data?.signups.week}</div>
          <div className="admin-card__sub">
            {data?.signups.day} {t("admin.today")}
          </div>
        </div>
        <div className="admin-card">
          <div className="admin-card__label">{t("admin.signupsMonth")}</div>
          <div className="admin-card__value">{data?.signups.month}</div>
        </div>
        <div className="admin-card">
          <div className="admin-card__label">{t("admin.activeUsers")}</div>
          <div className="admin-card__value">{data?.active_users.week}</div>
          <div className="admin-card__sub">
            {t("admin.activeUsersSub", {
              day: data?.active_users.day,
              month: data?.active_users.month,
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
