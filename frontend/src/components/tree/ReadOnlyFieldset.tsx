import type { ReactNode } from "react";

/**
 * Wraps a panel's controls for a tree shared with the user: a disabled
 * fieldset switches off every input, select and button inside it natively,
 * so nothing there can change, or save, the tree. Renders the children
 * unwrapped otherwise, leaving the owner's panels exactly as they were.
 */
export function ReadOnlyFieldset({
  readOnly,
  children,
}: {
  readOnly: boolean;
  children: ReactNode;
}) {
  if (!readOnly) return <>{children}</>;
  return (
    <fieldset disabled className="panel-readonly">
      {children}
    </fieldset>
  );
}
