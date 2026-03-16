import { House, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ActivitySection } from "../components/admin/ActivitySection";
import { FeatureTogglesSection } from "../components/admin/FeatureTogglesSection";
import { FeedbackSection } from "../components/admin/FeedbackSection";
import { FunnelSection } from "../components/admin/FunnelSection";
import { GrowthSection } from "../components/admin/GrowthSection";
import { OverviewSection } from "../components/admin/OverviewSection";
import { RetentionSection } from "../components/admin/RetentionSection";
import { UsageSection } from "../components/admin/UsageSection";
import { UserListSection } from "../components/admin/UserListSection";
import { WaitlistSection } from "../components/admin/WaitlistSection";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAdminData } from "../hooks/useAdminData";
import { useLogout } from "../hooks/useLogout";
import "../styles/admin.css";
import "../components/tree/TreeCanvas.css";

/** @deprecated Import from ../components/admin/FeatureTogglesSection instead */
export { FeatureToggleCard } from "../components/admin/FeatureTogglesSection";

export default function AdminPage() {
  const { t } = useTranslation();
  const logout = useLogout();
  const data = useAdminData();

  return (
    <div className="admin-page">
      <div className="tree-toolbar">
        <span className="tree-toolbar__title">{t("admin.title")}</span>
        <div className="tree-toolbar__spacer" />

        <div className="tree-toolbar__group">
          <Link to="/trees" className="tree-toolbar__icon-btn" aria-label={t("nav.trees")}>
            <House size={16} />
            <span className="tree-toolbar__btn-label">{t("toolbar.home")}</span>
          </Link>
        </div>

        <div className="tree-toolbar__separator" />

        <div className="tree-toolbar__group">
          <ThemeToggle className="tree-toolbar__icon-btn" showLabel />
          <button
            type="button"
            className="tree-toolbar__icon-btn"
            onClick={logout}
            aria-label={t("nav.logout")}
          >
            <LogOut size={16} />
            <span className="tree-toolbar__btn-label">{t("toolbar.logout")}</span>
          </button>
        </div>
      </div>

      {data.isLoading && <div className="admin-loading">{t("common.loading")}</div>}
      {data.error && <div className="admin-error">{t("admin.loadError")}</div>}

      {!data.isLoading && !data.error && (
        <div className="admin-content">
          <OverviewSection data={data.overview.data} />
          {data.funnel.data && <FunnelSection data={data.funnel.data} />}
          {data.growth.data && data.growth.data.points.length > 0 && (
            <GrowthSection points={data.growth.data.points} />
          )}
          {data.activity.data && <ActivitySection data={data.activity.data} />}
          <RetentionSection data={data.retention.data} />
          {data.usage.data && <UsageSection data={data.usage.data} />}
          {data.users.data && <UserListSection data={data.users.data} />}
          <WaitlistSection
            data={data.waitlist.data}
            capacityData={data.waitlistCapacity.data}
            approveMutation={data.approveMutation}
            deleteMutation={data.deleteMutation}
          />
          <FeedbackSection
            data={data.feedback.data}
            markReadMutation={data.markReadMutation}
            deleteFeedbackMutation={data.deleteFeedbackMutation}
          />
          {data.features.data && (
            <FeatureTogglesSection
              data={data.features.data}
              users={data.users.data?.users ?? []}
              updateFeatureMutation={data.updateFeatureMutation}
            />
          )}
        </div>
      )}
    </div>
  );
}
