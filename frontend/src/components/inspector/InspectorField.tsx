import type { ReactNode } from "react";
import "./inspector.css";

/**
 * A quiet inspector field: label above, value below. The value renders as
 * calm text on the panel surface; hover reveals a subtle field background,
 * focus restores the full input look. Pass the input/select/textarea as the
 * child; the label element associates it for a11y.
 */
export function InspectorField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is the child; every call site passes an input, select, or textarea, which the wrapping label associates implicitly.
    <label className={className ? `inspector-field ${className}` : "inspector-field"}>
      <span className="inspector-field__label">{label}</span>
      {children}
    </label>
  );
}
