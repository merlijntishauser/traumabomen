import { useNodes, useViewport } from "@xyflow/react";
import { useMemo } from "react";
import type { DecryptedPattern } from "../../hooks/useTreeData";
import type { PersonNodeType } from "../../hooks/useTreeLayout";
import { NODE_HEIGHT, NODE_WIDTH } from "../../hooks/useTreeLayout";

interface PatternConnectorsProps {
  patterns: Map<string, DecryptedPattern>;
  visiblePatternIds: Set<string>;
  onPatternClick?: (patternId: string) => void;
}

interface Line {
  patternId: string;
  color: string;
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  offset: number;
}

export function PatternConnectors({
  patterns,
  visiblePatternIds,
  onPatternClick,
}: PatternConnectorsProps) {
  const nodes = useNodes<PersonNodeType>();
  const { x: vx, y: vy, zoom } = useViewport();

  const nodeCenter = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const node of nodes) {
      map.set(node.id, {
        x: node.position.x + NODE_WIDTH / 2,
        y: node.position.y + NODE_HEIGHT / 2,
      });
    }
    return map;
  }, [nodes]);

  const lines = useMemo(() => {
    const result: Line[] = [];
    // Track segment counts for offset calculation
    const segmentCounts = new Map<string, number>();

    for (const pattern of patterns.values()) {
      if (!visiblePatternIds.has(pattern.id)) continue;

      // Collect unique person IDs from linked entities
      const personIds = new Set(pattern.person_ids);
      const personIdArray = Array.from(personIds).filter((pid) => nodeCenter.has(pid));

      // Generate all unique pairs
      for (let i = 0; i < personIdArray.length; i++) {
        for (let j = i + 1; j < personIdArray.length; j++) {
          const a = personIdArray[i];
          const b = personIdArray[j];
          const segKey = [a, b].sort().join("-");
          const count = segmentCounts.get(segKey) ?? 0;
          segmentCounts.set(segKey, count + 1);

          const centerA = nodeCenter.get(a)!;
          const centerB = nodeCenter.get(b)!;

          result.push({
            patternId: pattern.id,
            color: pattern.color,
            name: pattern.name,
            x1: centerA.x,
            y1: centerA.y,
            x2: centerB.x,
            y2: centerB.y,
            offset: count * 3,
          });
        }
      }
    }
    return result;
  }, [patterns, visiblePatternIds, nodeCenter]);

  if (lines.length === 0) return null;

  return (
    <svg
      data-testid="pattern-connectors"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <g transform={`translate(${vx}, ${vy}) scale(${zoom})`}>
        {lines.map((line, i) => {
          // Perpendicular offset for overlapping lines
          const dx = line.x2 - line.x1;
          const dy = line.y2 - line.y1;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = (-dy / len) * line.offset;
          const ny = (dx / len) * line.offset;

          return (
            <line
              key={`${line.patternId}-${i}`}
              x1={line.x1 + nx}
              y1={line.y1 + ny}
              x2={line.x2 + nx}
              y2={line.y2 + ny}
              stroke={line.color}
              strokeWidth={2}
              strokeDasharray="4 4"
              opacity={0.6}
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onClick={() => onPatternClick?.(line.patternId)}
            >
              <title>{line.name}</title>
            </line>
          );
        })}
      </g>
    </svg>
  );
}
