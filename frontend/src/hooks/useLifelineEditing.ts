import { useState } from "react";
import type { LifelineKind } from "../lib/lifeline";

/**
 * Sentinel entity id meaning "open the new-entry form" rather than edit an
 * existing entity. The node context menu's add-shortcut uses this to land the
 * person page directly on the creation form.
 */
export const CREATE_NEW = "__new__";

/** The lifeline entry being edited in place; a null id is a new entry of that kind. */
export interface LifelineEditing {
  kind: LifelineKind;
  id: string | null;
}

const LIFELINE_SECTIONS = new Set<string>([
  "trauma_event",
  "life_event",
  "turning_point",
  "classification",
]);

function fromRequest(
  section: string | null | undefined,
  entityId?: string,
): LifelineEditing | null {
  if (!section || !LIFELINE_SECTIONS.has(section) || !entityId) return null;
  return { kind: section as LifelineKind, id: entityId === CREATE_NEW ? null : entityId };
}

/**
 * Which lifeline entry is open. Starts from the requested section and entity
 * (a context-menu shortcut or a badge click), and follows later requests while
 * the page stays open; the user's own toggling wins in between. Showing a
 * different person starts over from that person's request.
 */
export function useLifelineEditing(
  section: string | null | undefined,
  entityId?: string,
  personId?: string,
) {
  const [editing, setEditing] = useState<LifelineEditing | null>(() =>
    fromRequest(section, entityId),
  );
  const [lastRequest, setLastRequest] = useState({ section, entityId, personId });

  if (
    lastRequest.section !== section ||
    lastRequest.entityId !== entityId ||
    lastRequest.personId !== personId
  ) {
    const personChanged = lastRequest.personId !== personId;
    setLastRequest({ section, entityId, personId });
    const requested = fromRequest(section, entityId);
    if (requested || personChanged) setEditing(requested);
  }

  const isOpen = (kind: LifelineKind, id: string | null) =>
    editing !== null && editing.kind === kind && editing.id === id;

  const toggle = (kind: LifelineKind, id: string) =>
    setEditing((current) => (current?.kind === kind && current.id === id ? null : { kind, id }));

  const startNew = (kind: LifelineKind) => setEditing({ kind, id: null });

  const close = () => setEditing(null);

  return { editing, isOpen, toggle, startNew, close };
}
