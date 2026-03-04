import { useMemo } from "react";

interface Leaf {
  /** SVG path data for the leaf shape */
  d: string;
  /** Centre x position (within 1000x1000 viewBox) */
  x: number;
  /** Centre y position */
  y: number;
  /** Rotation in degrees */
  rotation: number;
  /** Uniform scale factor */
  scale: number;
  /** Individual opacity variation */
  opacity: number;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/**
 * Hand-drawn leaf silhouettes. Each path is normalised around (0,0)
 * at roughly 20-30px size so they can be scaled uniformly.
 */
const LEAF_SHAPES = [
  // Simple oval leaf with pointed tip and a stem hint
  "M0,-14 C5,-12 8,-4 7,2 C6,8 2,14 0,16 C-2,14 -6,8 -7,2 C-8,-4 -5,-12 0,-14Z M0,-14 L0,16",
  // Slightly asymmetric birch-style leaf
  "M0,-12 C6,-10 10,-3 9,3 C8,7 3,12 0,14 C-4,11 -8,6 -9,2 C-10,-4 -5,-10 0,-12Z M0,-12 L0,14",
  // Rounded, wider leaf (linden-like)
  "M0,-10 C7,-8 12,-2 11,4 C10,8 4,12 0,13 C-4,12 -10,8 -11,4 C-12,-2 -7,-8 0,-10Z M0,1 L0,13",
  // Elongated willow leaf
  "M0,-16 C3,-13 5,-6 4,2 C3,9 1,15 0,18 C-1,15 -3,9 -4,2 C-5,-6 -3,-13 0,-16Z M0,-16 L0,18",
];

function generateLeaves(): Leaf[] {
  const leaves: Leaf[] = [];
  const count = Math.floor(rand(12, 20));

  for (let i = 0; i < count; i++) {
    const shapeIdx = Math.floor(rand(0, LEAF_SHAPES.length));
    leaves.push({
      d: LEAF_SHAPES[shapeIdx],
      x: rand(40, 960),
      y: rand(40, 960),
      rotation: rand(0, 360),
      scale: rand(0.6, 1.4),
      opacity: rand(0.4, 1),
    });
  }

  return leaves;
}

export function BranchDecoration() {
  const leaves = useMemo(generateLeaves, []);

  return (
    <svg
      className="branch-decoration"
      viewBox="0 0 1000 1000"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {leaves.map((leaf, i) => (
        <g
          key={`leaf-${i}-${leaf.x.toFixed(0)}-${leaf.y.toFixed(0)}`}
          transform={`translate(${leaf.x.toFixed(1)},${leaf.y.toFixed(1)}) rotate(${leaf.rotation.toFixed(0)}) scale(${leaf.scale.toFixed(2)})`}
          opacity={leaf.opacity}
        >
          <path d={leaf.d} fill="var(--color-accent)" stroke="none" />
        </g>
      ))}
    </svg>
  );
}
