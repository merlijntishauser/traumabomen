import { Plus } from "lucide-react";
import "./inspector.css";

/**
 * Ghost affordance for an absent optional group: one muted row that reveals
 * the real fields when clicked (e.g. "+ Add date of death").
 */
export function InspectorGhostRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="inspector-ghost" onClick={onClick}>
      <Plus size={14} aria-hidden="true" />
      {label}
    </button>
  );
}
