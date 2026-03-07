import type { UseMutationResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatDate } from "../../hooks/useAdminData";
import type { FeedbackItem } from "../../types/api";

export function FeedbackSection({
  data,
  markReadMutation,
  deleteFeedbackMutation,
}: {
  data: { items: FeedbackItem[] } | undefined;
  markReadMutation: UseMutationResult<FeedbackItem, Error, string>;
  deleteFeedbackMutation: UseMutationResult<void, Error, string>;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  return (
    <section>
      <div className="admin-section__title">{t("admin.feedback")}</div>
      {data && data.items.length > 0 ? (
        <div className="admin-users">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>{t("admin.feedbackDate")}</th>
                <th>{t("admin.feedbackCategory")}</th>
                <th>{t("admin.feedbackMessage")}</th>
                <th>{t("admin.feedbackUser")}</th>
                <th>{t("admin.waitlist.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item: FeedbackItem) => (
                <tr
                  key={item.id}
                  className={item.is_read ? undefined : "admin-feedback-row--unread"}
                >
                  <td>
                    <span className="admin-feedback-date">
                      {!item.is_read && <span className="admin-feedback-unread" />}
                      {formatDate(item.created_at, locale)}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`admin-feedback-badge admin-feedback-badge--${item.category}`}
                    >
                      {t(
                        `feedback.category${item.category.charAt(0).toUpperCase()}${item.category.slice(1)}`,
                      )}
                    </span>
                  </td>
                  <td className="admin-feedback-message" title={item.message}>
                    {item.message.length > 100
                      ? `${item.message.slice(0, 100)}...`
                      : item.message}
                  </td>
                  <td>{item.user_email ?? t("admin.feedbackAnonymous")}</td>
                  <td className="admin-feedback-actions">
                    {!item.is_read && (
                      <button
                        type="button"
                        className="admin-feedback-btn admin-feedback-btn--read"
                        onClick={() => markReadMutation.mutate(item.id)}
                        disabled={markReadMutation.isPending}
                      >
                        {t("admin.feedbackMarkRead")}
                      </button>
                    )}
                    <button
                      type="button"
                      className="admin-feedback-btn admin-feedback-btn--delete"
                      onClick={() => deleteFeedbackMutation.mutate(item.id)}
                      disabled={deleteFeedbackMutation.isPending}
                    >
                      {t("admin.feedbackDelete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-cohort-empty">{t("admin.feedbackEmpty")}</div>
      )}
    </section>
  );
}
