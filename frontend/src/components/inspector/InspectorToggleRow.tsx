import "./inspector.css";

/**
 * Full-width toggle row: label left, switch right, comfortable hit target.
 * The native checkbox stays in the accessibility tree; the track is visual.
 */
export function InspectorToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inspector-toggle">
      <span className="inspector-toggle__label">{label}</span>
      <input
        type="checkbox"
        className="inspector-toggle__input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="inspector-toggle__track" aria-hidden="true">
        <span className="inspector-toggle__knob" />
      </span>
    </label>
  );
}
