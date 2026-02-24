import { useEffect, useState } from "react";

/**
 * Shared editing state for event tab components.
 * Manages the editingId / showNew toggle pattern used by
 * TraumaEventsTab, LifeEventsTab, TurningPointsTab, and ClassificationsTab.
 */
export function useEditingState(initialEditId?: string) {
  const [editingId, setEditingId] = useState<string | null>(initialEditId ?? null);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (initialEditId) {
      setEditingId(initialEditId);
      setShowNew(false);
    }
  }, [initialEditId]);

  const isEditing = editingId !== null || showNew;

  const clearEditing = () => {
    setEditingId(null);
    setShowNew(false);
  };

  return { editingId, setEditingId, showNew, setShowNew, isEditing, clearEditing };
}
