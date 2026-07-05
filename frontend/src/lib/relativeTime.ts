/**
 * Compact relative time for "last tended" lines, via Intl.RelativeTimeFormat.
 * Falls back to today/yesterday granularity; never shows raw timestamps.
 */
const STEPS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: "year", seconds: 365 * 24 * 3600 },
  { unit: "month", seconds: 30 * 24 * 3600 },
  { unit: "week", seconds: 7 * 24 * 3600 },
  { unit: "day", seconds: 24 * 3600 },
  { unit: "hour", seconds: 3600 },
  { unit: "minute", seconds: 60 },
];

// The app speaks exactly English and Dutch; one formatter each, built once.
const FORMATTERS: Record<string, Intl.RelativeTimeFormat> = {
  en: new Intl.RelativeTimeFormat("en", { numeric: "auto" }),
  nl: new Intl.RelativeTimeFormat("nl", { numeric: "auto" }),
};

function formatterFor(locale: string): Intl.RelativeTimeFormat {
  return FORMATTERS[locale.slice(0, 2)] ?? FORMATTERS.en;
}

export function formatRelativeTime(iso: string, locale: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const elapsed = Math.max(0, (now - then) / 1000);

  const fmt = formatterFor(locale);
  for (const step of STEPS) {
    if (elapsed >= step.seconds) {
      return fmt.format(-Math.floor(elapsed / step.seconds), step.unit);
    }
  }
  return fmt.format(0, "minute");
}
