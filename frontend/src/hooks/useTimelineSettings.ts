import { useCallback, useState } from "react";

export interface TimelineSettings {
  showPartnerLines: boolean;
  showClassifications: boolean;
  showGridlines: boolean;
  showMarkerLabels: boolean;
}

const DEFAULTS: TimelineSettings = {
  showPartnerLines: true,
  showClassifications: true,
  showGridlines: false,
  showMarkerLabels: true,
};

const STORAGE_KEY = "traumabomen-timeline-settings";

function loadSettings(): TimelineSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function useTimelineSettings() {
  const [settings, setSettings] = useState<TimelineSettings>(loadSettings);

  const update = useCallback((partial: Partial<TimelineSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, update } as const;
}
