import type { UseMutationResult } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminFeatureFlag, AdminFeaturesResponse, UserRow } from "../../types/api";

type AudienceValue = AdminFeatureFlag["audience"];

const AUDIENCE_OPTIONS: AudienceValue[] = ["disabled", "all", "admins", "selected"];

/** @internal Exported for testing */
export function FeatureToggleCard({
  flag,
  allUsers,
  isPending,
  onUpdate,
}: {
  flag: AdminFeatureFlag;
  allUsers: UserRow[];
  isPending: boolean;
  onUpdate: (audience: AudienceValue, userIds?: string[]) => void;
}) {
  const { t } = useTranslation();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(
    () => new Set(flag.selected_user_ids),
  );
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close dropdown on outside click
  useEffect(() => {
    if (!userDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userDropdownOpen]);

  // Sync selected users when flag data changes from server
  useEffect(() => {
    setSelectedUsers(new Set(flag.selected_user_ids));
    clearTimeout(debounceRef.current);
  }, [flag.selected_user_ids]);

  // Clean up debounce timeout on unmount
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleAudienceChange = useCallback(
    (audience: AudienceValue) => {
      if (audience === "selected") {
        onUpdate(audience, Array.from(selectedUsers));
      } else {
        onUpdate(audience);
      }
    },
    [onUpdate, selectedUsers],
  );

  const debouncedPersist = useCallback(
    (users: Set<string>) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onUpdate("selected", Array.from(users));
      }, 300);
    },
    [onUpdate],
  );

  const toggleUser = useCallback(
    (userId: string) => {
      setSelectedUsers((prev) => {
        const next = new Set(prev);
        if (next.has(userId)) {
          next.delete(userId);
        } else {
          next.add(userId);
        }
        debouncedPersist(next);
        return next;
      });
    },
    [debouncedPersist],
  );

  const selectedCount = selectedUsers.size;

  return (
    <div className="admin-ft-card">
      <div className="admin-ft-card__header">
        <div className="admin-ft-card__title">{t(`admin.features.${flag.key}`)}</div>
        <div className="admin-ft-card__desc">{t(`admin.features.${flag.key}Desc`)}</div>
      </div>

      <div className="admin-ft-card__options">
        {AUDIENCE_OPTIONS.map((option) => (
          <label
            key={option}
            className={`admin-ft-option${flag.audience === option ? " admin-ft-option--active" : ""}`}
          >
            <input
              type="radio"
              name={`audience-${flag.key}`}
              value={option}
              checked={flag.audience === option}
              onChange={() => handleAudienceChange(option)}
              disabled={isPending}
              className="admin-ft-option__radio"
            />
            <span className="admin-ft-option__label">{t(`admin.features.audience.${option}`)}</span>
          </label>
        ))}
      </div>

      {/* User picker for "selected" audience */}
      {flag.audience === "selected" && (
        <div className="admin-ft-users" ref={dropdownRef}>
          <button
            type="button"
            className="admin-ft-users__trigger"
            onClick={() => setUserDropdownOpen((o) => !o)}
            disabled={isPending}
          >
            <span className="admin-ft-users__summary">
              {selectedCount === 0
                ? t("admin.features.noUsersSelected")
                : t("admin.features.usersSelected", { count: selectedCount })}
            </span>
            <ChevronDown
              size={14}
              className={`admin-ft-users__chevron${userDropdownOpen ? " admin-ft-users__chevron--open" : ""}`}
            />
          </button>

          {userDropdownOpen && (
            <div className="admin-ft-users__dropdown">
              {allUsers.length === 0 ? (
                <div className="admin-ft-users__empty">{t("common.loading")}</div>
              ) : (
                allUsers.map((user) => (
                  <label key={user.id} className="admin-ft-users__item">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={() => toggleUser(user.id)}
                      disabled={isPending}
                    />
                    <span className="admin-ft-users__email">{user.email}</span>
                    {user.is_admin && (
                      <span className="admin-user-badge">{t("admin.adminBadge")}</span>
                    )}
                  </label>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FeatureTogglesSection({
  data,
  users,
  updateFeatureMutation,
}: {
  data: AdminFeaturesResponse;
  users: UserRow[];
  updateFeatureMutation: UseMutationResult<
    AdminFeatureFlag,
    Error,
    { key: string; audience: AdminFeatureFlag["audience"]; user_ids?: string[] }
  >;
}) {
  const { t } = useTranslation();

  return (
    <section>
      <div className="admin-section__title">{t("admin.featureToggles")}</div>
      <div className="admin-feature-toggles">
        {data.flags.map((flag) => (
          <FeatureToggleCard
            key={flag.key}
            flag={flag}
            allUsers={users}
            isPending={updateFeatureMutation.isPending}
            onUpdate={(audience, userIds) =>
              updateFeatureMutation.mutate({
                key: flag.key,
                audience,
                user_ids: userIds,
              })
            }
          />
        ))}
      </div>
    </section>
  );
}
