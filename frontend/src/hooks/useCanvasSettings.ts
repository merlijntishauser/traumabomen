import { useCallback, useState } from "react";

export type EdgeStyle = "curved" | "elbows" | "straight";

export interface CanvasSettings {
  showGrid: boolean;
  snapToGrid: boolean;
  edgeStyle: EdgeStyle;
  showMarkers: boolean;
  showMinimap: boolean;
}

const DEFAULTS: CanvasSettings = {
  showGrid: false,
  snapToGrid: false,
  edgeStyle: "curved",
  showMarkers: true,
  showMinimap: false,
};

const STORAGE_KEY = "traumabomen-canvas-settings";

function loadSettings(): CanvasSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function useCanvasSettings() {
  const [settings, setSettings] = useState<CanvasSettings>(loadSettings);

  const update = useCallback((partial: Partial<CanvasSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { settings, update } as const;
}
