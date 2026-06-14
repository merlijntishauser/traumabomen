import { useMemo, useState } from "react";
import { getPatternColor } from "../lib/patternColors";
import type { DecryptedPattern } from "./useTreeData";
import type { PersonNodeType, SiblingGroupNodeType } from "./useTreeLayout";

type FocusNode = PersonNodeType | SiblingGroupNodeType;

const EMPTY_PATTERN_IDS = new Set<string>();

/**
 * Tag canvas nodes for the pattern spotlight: members of the focused pattern
 * keep their look and carry the pattern colour on their top accent border;
 * everyone else is dimmed. Returns the nodes unchanged when nothing is focused.
 */
export function applyPatternFocusToNodes(
  nodes: FocusNode[],
  focusMemberIds: Set<string> | null,
  focusColor: string | null,
): FocusNode[] {
  if (!focusMemberIds || !focusColor) return nodes;
  return nodes.map((node) => {
    const isMember = node.type === "person" && focusMemberIds.has(node.id);
    const className = isMember
      ? node.className
      : [node.className, "rf-node-dimmed"].filter(Boolean).join(" ");
    if (node.type === "person") {
      return {
        ...node,
        className,
        data: { ...node.data, focusColor: isMember ? focusColor : undefined },
      };
    }
    return { ...node, className };
  });
}

/**
 * Single-pattern spotlight state for a tree canvas. Shared by the editable
 * workspace and the read-only public demo so both highlight patterns the same
 * way (dim everyone, light up one pattern's members in its colour).
 */
export function usePatternFocus(
  patterns: Map<string, DecryptedPattern>,
  nodes: FocusNode[],
  initialFocusId: string | null,
) {
  const [focusedPatternId, setFocusedPatternId] = useState<string | null>(initialFocusId);
  const focusedPattern = focusedPatternId ? (patterns.get(focusedPatternId) ?? null) : null;
  const focusColor = focusedPattern ? getPatternColor(focusedPattern.color) : null;
  const focusMemberIds = useMemo(
    () => (focusedPattern ? new Set(focusedPattern.person_ids) : null),
    [focusedPattern],
  );
  const displayNodes = useMemo(
    () => applyPatternFocusToNodes(nodes, focusMemberIds, focusColor),
    [nodes, focusMemberIds, focusColor],
  );
  const visiblePatternIds = useMemo(
    () => (focusedPatternId ? new Set([focusedPatternId]) : EMPTY_PATTERN_IDS),
    [focusedPatternId],
  );
  return {
    focusedPatternId,
    setFocusedPatternId,
    focusedPattern,
    focusColor,
    displayNodes,
    visiblePatternIds,
  };
}
