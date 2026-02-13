import { useMemo } from "react";

interface Branch {
  path: string;
  width: number;
}

interface Node {
  cx: number;
  cy: number;
  r: number;
}

function generate(): { branches: Branch[]; nodes: Node[] } {
  const branches: Branch[] = [];
  const nodes: Node[] = [];

  function rand(min: number, max: number) {
    return min + Math.random() * (max - min);
  }

  function grow(
    x: number,
    y: number,
    angle: number,
    length: number,
    width: number,
    depth: number,
    maxDepth: number,
  ) {
    const endX = x + Math.cos(angle) * length;
    const endY = y + Math.sin(angle) * length;

    // Bezier control point with slight curve
    const curve = rand(-length * 0.3, length * 0.3);
    const perpAngle = angle + Math.PI / 2;
    const cpX = (x + endX) / 2 + Math.cos(perpAngle) * curve;
    const cpY = (y + endY) / 2 + Math.sin(perpAngle) * curve;

    branches.push({
      path: `M ${x.toFixed(1)},${y.toFixed(1)} Q ${cpX.toFixed(1)},${cpY.toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`,
      width,
    });

    if (depth >= maxDepth) {
      nodes.push({ cx: endX, cy: endY, r: rand(2.5, 5) });
      return;
    }

    // Spawn sub-branches
    const count = Math.floor(rand(1.5, 3.5));
    for (let i = 0; i < count; i++) {
      // Spread branches across a range
      const spread = rand(0.4, 0.9);
      const side = i % 2 === 0 ? 1 : -1;
      const branchAngle = angle + side * spread + rand(-0.2, 0.2);
      const branchLen = length * rand(0.5, 0.75);
      const branchWidth = Math.max(1, width * 0.7);

      grow(endX, endY, branchAngle, branchLen, branchWidth, depth + 1, maxDepth);
    }
  }

  // Main trunk starting from bottom-left, growing up-right
  const startX = rand(10, 30);
  const startY = 420;
  const trunkAngle = rand(-1.2, -1.0); // roughly upward (-PI/2 = straight up)
  const trunkLen = rand(100, 140);
  const maxDepth = Math.floor(rand(3, 5));

  grow(startX, startY, trunkAngle, trunkLen, 2.5, 0, maxDepth);

  return { branches, nodes };
}

export function BranchDecoration() {
  const { branches, nodes } = useMemo(generate, []);

  return (
    <svg
      className="branch-decoration"
      viewBox="0 0 420 420"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {branches.map((b, i) => (
        <path
          key={i}
          d={b.path}
          stroke="var(--color-accent)"
          strokeWidth={b.width}
          strokeLinecap="round"
          fill="none"
        />
      ))}
      {nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.cx}
          cy={n.cy}
          r={n.r}
          fill="var(--color-accent)"
        />
      ))}
    </svg>
  );
}
