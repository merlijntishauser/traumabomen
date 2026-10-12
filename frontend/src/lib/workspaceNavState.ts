/**
 * What another page asked the tree workspace to open, read from the router's
 * navigation state: a pattern to spotlight on the canvas (`openPatternId`,
 * from the Patterns page's "Show in tree"), with its edit panel open too when
 * `editPattern` is set ("Edit"), or the new-pattern form (`newPattern`).
 * Anything else in the state is ignored.
 */
export function workspaceNavOptions(state: unknown): {
  openPatternId: string | undefined;
  initialPatternPanelOpen: boolean;
  initialPatternCreating: boolean;
} {
  const nav = (state ?? {}) as {
    openPatternId?: unknown;
    editPattern?: unknown;
    newPattern?: unknown;
  };
  const openPatternId = typeof nav.openPatternId === "string" ? nav.openPatternId : undefined;
  return {
    openPatternId,
    initialPatternPanelOpen: openPatternId !== undefined && nav.editPattern === true,
    initialPatternCreating: nav.newPattern === true,
  };
}
