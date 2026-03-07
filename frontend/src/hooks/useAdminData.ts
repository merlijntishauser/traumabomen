import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveWaitlistEntry,
  deleteFeedback,
  deleteWaitlistEntry,
  getAdminActivity,
  getAdminFeatures,
  getAdminFeedback,
  getAdminFunnel,
  getAdminGrowth,
  getAdminOverview,
  getAdminRetention,
  getAdminUsage,
  getAdminUsers,
  getAdminWaitlist,
  getAdminWaitlistCapacity,
  markFeedbackRead,
  updateAdminFeature,
} from "../lib/api";
import type { AdminFeatureFlag } from "../types/api";
import { featureQueryKeys } from "./useFeatureFlags";

export function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function useAdminData() {
  const queryClient = useQueryClient();

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
  const feedback = useQuery({ queryKey: ["admin", "feedback"], queryFn: getAdminFeedback });
  const waitlist = useQuery({ queryKey: ["admin", "waitlist"], queryFn: getAdminWaitlist });
  const waitlistCapacity = useQuery({
    queryKey: ["admin", "waitlist-capacity"],
    queryFn: getAdminWaitlistCapacity,
  });

  const approveMutation = useMutation({
    mutationFn: approveWaitlistEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "waitlist"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "waitlist-capacity"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWaitlistEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "waitlist"] });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: markFeedbackRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "feedback"] });
    },
  });

  const deleteFeedbackMutation = useMutation({
    mutationFn: deleteFeedback,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "feedback"] });
    },
  });

  const features = useQuery({
    queryKey: ["admin", "features"],
    queryFn: getAdminFeatures,
  });

  const updateFeatureMutation = useMutation({
    mutationFn: ({
      key,
      audience,
      user_ids,
    }: {
      key: string;
      audience: AdminFeatureFlag["audience"];
      user_ids?: string[];
    }) => updateAdminFeature(key, { audience, user_ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "features"] });
      queryClient.invalidateQueries({ queryKey: featureQueryKeys.flags() });
    },
  });

  const isLoading =
    overview.isLoading ||
    funnel.isLoading ||
    growth.isLoading ||
    activity.isLoading ||
    retention.isLoading ||
    usage.isLoading ||
    users.isLoading ||
    feedback.isLoading ||
    waitlist.isLoading ||
    waitlistCapacity.isLoading;

  const error =
    overview.error ||
    funnel.error ||
    growth.error ||
    activity.error ||
    retention.error ||
    usage.error ||
    users.error ||
    feedback.error ||
    waitlist.error ||
    waitlistCapacity.error;

  return {
    overview,
    funnel,
    growth,
    activity,
    retention,
    usage,
    users,
    feedback,
    waitlist,
    waitlistCapacity,
    approveMutation,
    deleteMutation,
    markReadMutation,
    deleteFeedbackMutation,
    features,
    updateFeatureMutation,
    isLoading,
    error,
  };
}
