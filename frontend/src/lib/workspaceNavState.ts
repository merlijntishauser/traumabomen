/**
 * What another page asked the tree workspace to open, read from the router's
 * navigation state: a pattern to expand (`openPatternId`, from a pattern card's
 * "Edit on canvas") or the new-pattern form (`newPattern`, from the Patterns
 * page). Anything else in the state is ignored.
 */
export function workspaceNavOptions(state: unknown): {
  openPatternId: string | undefined;
  initialPatternPanelOpen: boolean;
  initialPatternCreating: boolean;
} {
  const nav = (state ?? {}) as { openPatternId?: unknown; newPattern?: unknown };
  const openPatternId = typeof nav.openPatternId === "string" ? nav.openPatternId : undefined;
  return {
    openPatternId,
    initialPatternPanelOpen: openPatternId !== undefined,
    initialPatternCreating: nav.newPattern === true,
  };
}
