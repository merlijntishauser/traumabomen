import type { UseMutationResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatDate } from "../../hooks/useAdminData";
import type { UserListStats, UserRow } from "../../types/api";
import { ConfirmDeleteButton } from "../ConfirmDeleteButton";

export function UserListSection({
  data,
  deleteUserMutation,
}: {
  data: UserListStats;
  deleteUserMutation: UseMutationResult<void, Error, string>;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  return (
    <section>
      <div className="admin-section__title">{t("admin.userList")}</div>
      {deleteUserMutation.isError && (
        <p className="admin-users__error" role="alert">
          {t("admin.deleteUserFailed")}
        </p>
      )}
      <div className="admin-users">
        <table className="admin-users-table">
          <thead>
            <tr>
              <th>{t("admin.email")}</th>
              <th>{t("admin.signedUp")}</th>
              <th>{t("admin.lastActive")}</th>
              <th>{t("admin.emailVerified")}</th>
              <th>{t("admin.trees")}</th>
              <th>{t("admin.persons")}</th>
              <th>{t("admin.rels")}</th>
              <th>{t("admin.events")}</th>
              <th>
                <span className="sr-only">{t("admin.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((user: UserRow) => (
              <tr key={user.id}>
                <td className="admin-users-table__email">
                  {user.email}
                  {user.is_admin && (
                    <span className="admin-user-badge">{t("admin.adminBadge")}</span>
                  )}
                </td>
                <td>{formatDate(user.created_at, locale)}</td>
                <td>
                  {user.last_active
                    ? formatDate(user.last_active, locale)
                    : t("common.notAvailable")}
                </td>
                <td>{user.email_verified ? t("admin.yes") : t("admin.no")}</td>
                <td>{user.tree_count}</td>
                <td>{user.person_count}</td>
                <td>{user.relationship_count}</td>
                <td>{user.event_count}</td>
                <td className="admin-users-table__actions">
                  {/* Admins are not deletable here (the server refuses too). */}
                  {!user.is_admin && (
                    <ConfirmDeleteButton
                      onConfirm={() => deleteUserMutation.mutate(user.id)}
                      label={t("admin.deleteUser")}
                      confirmLabel={t("admin.deleteUserConfirm")}
                      className="btn btn--danger admin-users-table__delete"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
