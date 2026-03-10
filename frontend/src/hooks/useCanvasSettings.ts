import { useLocalStorageSettings } from "./useLocalStorageSettings";

export type EdgeStyle = "curved" | "elbows" | "straight";

export interface CanvasSettings {
  showGrid: boolean;
  snapToGrid: boolean;
  edgeStyle: EdgeStyle;
  showMarkers: boolean;
  showMinimap: boolean;
  promptRelationship: boolean;
  showReflectionPrompts: boolean;
  showParentEdges: boolean;
  showPartnerEdges: boolean;
  showSiblingEdges: boolean;
  showFriendEdges: boolean;
  autoLockMinutes: number;
}

const DEFAULTS: CanvasSettings = {
  showGrid: false,
  snapToGrid: false,
  edgeStyle: "curved",
  showMarkers: true,
  showMinimap: false,
  promptRelationship: true,
  showReflectionPrompts: false,
  showParentEdges: true,
  showPartnerEdges: true,
  showSiblingEdges: true,
  showFriendEdges: true,
  autoLockMinutes: 15,
};

export function useCanvasSettings() {
  return useLocalStorageSettings("traumabomen-canvas-settings", DEFAULTS);
}
