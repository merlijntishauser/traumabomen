/**
 * Decorative art for the public landing page.
 * Pure SVG drawn with theme tokens so dark/light/watercolor all hold.
 * Decorative only (aria-hidden): the surrounding copy carries the meaning.
 */

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
      <g fill="var(--color-action)">
        <circle cx="42" cy="140" r="3.5" />
        <circle cx="42" cy="172" r="3.5" />
        <circle cx="42" cy="204" r="3.5" />
      </g>
      {/* Shield with lock, in the Lucide grammar (2px stroke, round joins).
          Rides --color-action so the mark reads indigo in the light theme
          (and green in dark), matching the page's interactive accent. */}
      <path
        d="M120 14 L172 36 v32 c0 34 -22 52 -52 64 -30 -12 -52 -30 -52 -64 V36 Z"
        fill="var(--color-action-subtle)"
        stroke="var(--color-action)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="103" y="62" width="34" height="28" rx="5" fill="var(--color-action)" />
      <path
        d="M110 62 v-10 a10 10 0 0 1 20 0 v10"
        fill="none"
        stroke="var(--color-action)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
