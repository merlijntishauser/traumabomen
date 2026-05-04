interface LogomarkProps {
  size?: number;
  className?: string;
}

/**
 * Brand logomark — the "tree of life" SVG used as the favicon and on auth /
 * brand surfaces. Six accent-colored boughs, three filled accent dots, three
 * earth-toned leaf dots in trauma/classification/muted hues to echo the
 * domain palette without being decorative noise.
 *
 * Stays in lockstep with `docs/design_handoff/ui_kits/traumatrees-app/components.jsx`.
 */
export function Logomark({ size = 28, className }: LogomarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M32 56 L32 38"
        stroke="var(--color-accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M32 38 Q32 30 22 26"
        stroke="var(--color-accent)"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M32 38 Q32 30 42 26"
        stroke="var(--color-accent)"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M22 26 Q22 19 14 16"
        stroke="var(--color-accent)"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M22 26 Q22 19 28 14"
        stroke="var(--color-accent)"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M42 26 Q42 19 38 14"
        stroke="var(--color-accent)"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M42 26 Q42 19 50 16"
        stroke="var(--color-accent)"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="32" cy="38" r="3" fill="var(--color-accent)" />
      <circle cx="22" cy="26" r="2.5" fill="var(--color-accent)" />
      <circle cx="42" cy="26" r="2.5" fill="var(--color-accent)" />
      <circle cx="14" cy="16" r="2" fill="var(--color-text-primary)" />
      <circle cx="28" cy="14" r="2" fill="var(--color-trauma-loss)" />
      <circle cx="38" cy="14" r="2" fill="var(--color-classification-suspected)" />
      <circle cx="50" cy="16" r="2" fill="var(--color-text-muted)" />
    </svg>
  );
}
