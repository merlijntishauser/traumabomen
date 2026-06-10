/**
 * Decorative product-glimpse art for the public landing page.
 * Pure SVG drawn with theme tokens so dark/light/watercolor all hold.
 * Everything here is aria-hidden: the surrounding copy carries the meaning.
 */

function PersonNodeArt({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect
        width="108"
        height="44"
        rx="8"
        fill="var(--color-bg-tertiary)"
        stroke="var(--color-border-primary)"
        strokeWidth="1"
      />
      <rect
        x="12"
        y="13"
        width="56"
        height="6"
        rx="3"
        fill="var(--color-text-muted)"
        opacity="0.55"
      />
      <rect
        x="12"
        y="26"
        width="36"
        height="5"
        rx="2.5"
        fill="var(--color-text-muted)"
        opacity="0.3"
      />
    </g>
  );
}

/** Mini tree-canvas: two parents, two children, one grandchild, with badges. */
export function CanvasGlimpse() {
  return (
    <svg viewBox="0 0 380 310" role="presentation" aria-hidden="true" focusable="false">
      {/* Edges first, under the nodes. */}
      <g stroke="var(--color-edge-default)" strokeWidth="1.5" fill="none" opacity="0.8">
        {/* Parents to children */}
        <path d="M183 46 V100" />
        <path d="M183 100 H96 V140" />
        <path d="M183 100 H270 V140" />
        {/* Child to grandchild */}
        <path d="M270 184 V216 H183 V248" />
      </g>
      {/* Partner edge */}
      <path d="M150 46 H216" stroke="var(--color-edge-partner)" strokeWidth="1.5" fill="none" />

      <PersonNodeArt x={42} y={24} />
      <PersonNodeArt x={216} y={24} />
      <PersonNodeArt x={42} y={140} />
      <PersonNodeArt x={216} y={140} />
      <PersonNodeArt x={129} y={248} />

      {/* Badges: circles = trauma, squares = life events, triangles = classifications. */}
      <circle cx="60" cy="184" r="5.5" fill="var(--color-trauma-loss)" />
      <path d="M76 189.5 l5.5 -10 l5.5 10 Z" fill="var(--color-classification-suspected)" />
      <rect x="229" y="178.5" width="11" height="11" rx="2" fill="var(--color-life-family)" />
      <circle cx="147" cy="292" r="5.5" fill="var(--color-trauma-addiction)" />
      <circle cx="163" cy="292" r="5.5" fill="var(--color-trauma-loss)" />
    </svg>
  );
}

/** The badge language: circles = trauma, squares = life events, triangles = classifications. */
export function ShapesGlimpse() {
  return (
    <svg viewBox="0 0 240 220" role="presentation" aria-hidden="true" focusable="false">
      <g transform="translate(66 16)">
        <rect
          width="108"
          height="44"
          rx="8"
          fill="var(--color-bg-tertiary)"
          stroke="var(--color-border-primary)"
          strokeWidth="1"
        />
        <rect
          x="12"
          y="13"
          width="56"
          height="6"
          rx="3"
          fill="var(--color-text-muted)"
          opacity="0.55"
        />
        <rect
          x="12"
          y="26"
          width="36"
          height="5"
          rx="2.5"
          fill="var(--color-text-muted)"
          opacity="0.3"
        />
        <circle cx="18" cy="44" r="5.5" fill="var(--color-trauma-loss)" />
        <rect x="30" y="38.5" width="11" height="11" rx="2" fill="var(--color-life-family)" />
        <path d="M50 49.5 l5.5 -10 l5.5 10 Z" fill="var(--color-classification-suspected)" />
      </g>
      {/* The three shapes, enlarged, as a quiet legend */}
      <g>
        <circle cx="64" cy="124" r="17" fill="var(--color-trauma-loss)" opacity="0.9" />
        <rect
          x="103"
          y="107"
          width="34"
          height="34"
          rx="6"
          fill="var(--color-life-family)"
          opacity="0.9"
        />
        <path
          d="M159 141 l21 -36 l21 36 Z"
          fill="var(--color-classification-suspected)"
          opacity="0.9"
        />
      </g>
      <g fill="var(--color-text-muted)" opacity="0.4">
        <rect x="46" y="158" width="36" height="6" rx="3" />
        <rect x="102" y="158" width="36" height="6" rx="3" />
        <rect x="162" y="158" width="36" height="6" rx="3" />
      </g>
      {/* A pattern connector linking two of them */}
      <path
        d="M64 178 q56 30 116 0"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="1.5"
        strokeDasharray="4 5"
        opacity="0.7"
      />
    </svg>
  );
}

/** Zero-knowledge glimpse: a shield over rows of unreadable ciphertext. */
export function ShieldGlimpse() {
  return (
    <svg viewBox="0 0 240 220" role="presentation" aria-hidden="true" focusable="false">
      {/* Ciphertext rows the server stores */}
      <g fill="var(--color-bg-tertiary)" stroke="var(--color-border-primary)" strokeWidth="1">
        <rect x="24" y="128" width="192" height="24" rx="6" />
        <rect x="24" y="160" width="192" height="24" rx="6" />
        <rect x="24" y="192" width="192" height="24" rx="6" />
      </g>
      <g fill="var(--color-text-muted)" opacity="0.4">
        <rect x="60" y="137" width="70" height="6" rx="3" />
        <rect x="138" y="137" width="40" height="6" rx="3" />
        <rect x="60" y="169" width="52" height="6" rx="3" />
        <rect x="120" y="169" width="62" height="6" rx="3" />
        <rect x="60" y="201" width="80" height="6" rx="3" />
      </g>
      <g fill="var(--color-accent)">
        <circle cx="42" cy="140" r="3.5" />
        <circle cx="42" cy="172" r="3.5" />
        <circle cx="42" cy="204" r="3.5" />
      </g>
      {/* Shield with lock, in the Lucide grammar (2px stroke, round joins) */}
      <path
        d="M120 14 L172 36 v32 c0 34 -22 52 -52 64 -30 -12 -52 -30 -52 -64 V36 Z"
        fill="var(--color-accent-subtle)"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="103" y="62" width="34" height="28" rx="5" fill="var(--color-accent)" />
      <path
        d="M110 62 v-10 a10 10 0 0 1 20 0 v10"
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
