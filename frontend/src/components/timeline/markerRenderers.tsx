import type React from "react";
import type {
  DecryptedClassification,
  DecryptedEvent,
  DecryptedLifeEvent,
  DecryptedTurningPoint,
} from "../../hooks/useTreeData";
import { ClassificationStrips } from "./ClassificationStrips";
import { LifeEventMarkers } from "./LifeEventMarkers";
import type { MarkerContext } from "./markerHelpers";
import { TraumaMarkers } from "./TraumaMarkers";
import { TurningPointMarkers } from "./TurningPointMarkers";

// ---- Backward-compatible render functions ----
// These thin wrappers maintain the existing API for call sites and tests.
// They delegate to the component versions via React.createElement.

export function renderClassificationStrips(
  ctx: MarkerContext,
  classifications: DecryptedClassification[],
): React.ReactNode {
  return <ClassificationStrips ctx={ctx} classifications={classifications} />;
}

export function renderTraumaMarkers(ctx: MarkerContext, events: DecryptedEvent[]): React.ReactNode {
  return <TraumaMarkers ctx={ctx} events={events} />;
}

export function renderTurningPointMarkers(
  ctx: MarkerContext,
  turningPoints: DecryptedTurningPoint[],
): React.ReactNode {
  if (!ctx.turningPointColors) return null;
  return <TurningPointMarkers ctx={ctx} turningPoints={turningPoints} />;
}

export function renderLifeEventMarkers(
  ctx: MarkerContext,
  lifeEvents: DecryptedLifeEvent[],
): React.ReactNode {
  return <LifeEventMarkers ctx={ctx} lifeEvents={lifeEvents} />;
}
