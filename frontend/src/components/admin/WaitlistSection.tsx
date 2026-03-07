import type { UseMutationResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatDate } from "../../hooks/useAdminData";
import type { WaitlistCapacity, WaitlistEntry, WaitlistListResponse } from "../../types/api";

export function WaitlistSection({
  data,
  capacityData,
  approveMutation,
  deleteMutation,
}: {
  data: WaitlistListResponse | undefined;
  capacityData: WaitlistCapacity | undefined;
  approveMutation: UseMutationResult<void, Error, string>;
  deleteMutation: UseMutationResult<void, Error, string>;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  return (
    <section>
      <div className="admin-section__title">
        {t("admin.waitlist.title")}
        {capacityData && (
          <span className="admin-section__subtitle">
            {" "}
            (
            {t("admin.waitlist.capacity", {
              current: capacityData.active_users,
              max: capacityData.max_active_users,
            })}
            {!capacityData.waitlist_enabled && `, ${t("admin.waitlist.disabled")}`})
          </span>
        )}
      </div>
      {data && data.items.length > 0 ? (
        <>
          <div className="admin-waitlist-counts">
            <span className="admin-waitlist-badge admin-waitlist-badge--waiting">
              {data.waiting} {t("admin.waitlist.waiting")}
            </span>
            <span className="admin-waitlist-badge admin-waitlist-badge--approved">
              {data.approved} {t("admin.waitlist.approved")}
            </span>
            <span className="admin-waitlist-badge admin-waitlist-badge--registered">
              {data.registered} {t("admin.waitlist.registered")}
            </span>
          </div>
          <div className="admin-users">
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>{t("admin.email")}</th>
                  <th>{t("admin.waitlist.status")}</th>
                  <th>{t("admin.waitlist.joined")}</th>
                  <th>{t("admin.waitlist.approvedAt")}</th>
                  <th>{t("admin.waitlist.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry: WaitlistEntry) => (
                  <tr key={entry.id}>
                    <td className="admin-users-table__email">{entry.email}</td>
                    <td>
                      <span
                        className={`admin-waitlist-badge admin-waitlist-badge--${entry.status}`}
                      >
                        {t(`admin.waitlist.${entry.status}`)}
                      </span>
                    </td>
                    <td>{formatDate(entry.created_at, locale)}</td>
                    <td>
                      {entry.approved_at
                        ? formatDate(entry.approved_at, locale)
                        : t("common.notAvailable")}
                    </td>
                    <td className="admin-waitlist-actions">
                      {entry.status === "waiting" && (
                        <button
                          type="button"
                          className="admin-waitlist-btn admin-waitlist-btn--approve"
                          onClick={() => approveMutation.mutate(entry.id)}
                          disabled={approveMutation.isPending}
                        >
                          {t("admin.waitlist.approve")}
                        </button>
                      )}
                      <button
                        type="button"
                        className="admin-waitlist-btn admin-waitlist-btn--delete"
                        onClick={() => deleteMutation.mutate(entry.id)}
                        disabled={deleteMutation.isPending}
                      >
                        {t("admin.waitlist.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="admin-cohort-empty">{t("admin.waitlist.empty")}</div>
      )}
    </section>
  );
}
