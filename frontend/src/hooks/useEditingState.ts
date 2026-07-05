import { useState } from "react";

/**
 * Sentinel `initialEditId` meaning "open the new-entry form" rather than edit
 * an existing entity. The node context menu's add-shortcut uses this to land
 * the panel directly on the creation form.
 */
export const CREATE_NEW = "__new__";

/**
 * Shared editing state for event tab components.
 * Manages the editingId / showNew toggle pattern used by
 * TraumaEventsTab, LifeEventsTab, TurningPointsTab, and ClassificationsTab.
 */
export function useEditingState(initialEditId?: string) {
  const wantsNew = initialEditId === CREATE_NEW;
  const [editingId, setEditingId] = useState<string | null>(
    initialEditId && !wantsNew ? initialEditId : null,
  );
  const [showNew, setShowNew] = useState(wantsNew);
  const [lastInitial, setLastInitial] = useState(initialEditId);

  if (initialEditId !== lastInitial) {
    setLastInitial(initialEditId);
    if (initialEditId === CREATE_NEW) {
      setEditingId(null);
      setShowNew(true);
    } else if (initialEditId) {
      setEditingId(initialEditId);
      setShowNew(false);
    }
  }

  const isEditing = editingId !== null || showNew;

  const clearEditing = () => {
    setEditingId(null);
    setShowNew(false);
  };

  return { editingId, setEditingId, showNew, setShowNew, isEditing, clearEditing };
}
