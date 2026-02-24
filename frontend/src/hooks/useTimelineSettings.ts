import { useLocalStorageSettings } from "./useLocalStorageSettings";

export interface TimelineSettings {
  showPartnerLines: boolean;
  showPartnerLabels: boolean;
  showClassifications: boolean;
  showGridlines: boolean;
  showMarkerLabels: boolean;
}

const DEFAULTS: TimelineSettings = {
  showPartnerLines: true,
  showPartnerLabels: true,
  showClassifications: true,
  showGridlines: false,
  showMarkerLabels: true,
};

export function useTimelineSettings() {
  return useLocalStorageSettings("traumabomen-timeline-settings", DEFAULTS);
}
