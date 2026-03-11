import { useMemo } from "react";

const PHRASES = [
  "reflecting",
  "remembering",
  "family",
  "roots",
  "generations",
  "stories",
  "healing",
  "patterns",
  "resilience",
  "connection",
  "belonging",
  "strength",
  "heritage",
  "legacy",
  "growth",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Ruled lines: y positions at 12, 18, 24, ... (step 6)
const LINE_START_Y = 12;
const LINE_STEP = 6;
const LINE_COUNT = 14;

interface GridWord {
  text: string;
  x: number;
  lineIndex: number;
  opacity: number;
}

function generateGridWords(): GridWord[] {
  const words: GridWord[] = [];
  // Place 1-2 words on random ruled lines
  const usedLines = new Set<number>();
  const count = 8 + Math.floor(Math.random() * 6);

  for (let i = 0; i < count; i++) {
    let lineIndex: number;
    do {
      lineIndex = Math.floor(Math.random() * LINE_COUNT);
    } while (usedLines.has(lineIndex) && usedLines.size < LINE_COUNT);
    usedLines.add(lineIndex);

    words.push({
      text: pick(PHRASES),
      x: 16 + Math.random() * 60,
      lineIndex,
      opacity: 0.04 + Math.random() * 0.03,
    });
  }
  return words;
}

export function JournalDecoration() {
  const words = useMemo(() => generateGridWords(), []);

  return (
    <svg
      className="journal-decoration"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <filter id="text-blur">
          <feGaussianBlur stdDeviation="0.3" />
        </filter>
      </defs>

      {/* Ruled lines like a notebook page */}
      {Array.from({ length: LINE_COUNT }, (_, i) => {
        const y = LINE_START_Y + i * LINE_STEP;
        return (
          <line
            key={`rule-y${y}`}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="currentColor"
            strokeWidth="0.15"
            opacity="0.08"
          />
        );
      })}

      {/* Left margin line */}
      <line x1="14" y1="4" x2="14" y2="96" stroke="currentColor" strokeWidth="0.2" opacity="0.06" />

      {/* Script words sitting on the ruled lines */}
      {words.map((w) => (
        <text
          key={`w-${w.lineIndex}`}
          x={w.x}
          y={LINE_START_Y + w.lineIndex * LINE_STEP}
          fontSize={4.5}
          fill="currentColor"
          opacity={w.opacity}
          fontFamily="var(--font-heading)"
          fontWeight="200"
          dominantBaseline="auto"
          filter="url(#text-blur)"
        >
          {w.text}
        </text>
      ))}
    </svg>
  );
}
