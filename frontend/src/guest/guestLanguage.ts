export type GuestLanguage = "en" | "nl";

/** The language a host implies. Same rules as the main app's hostname detector (src/i18n.ts). */
export function languageForHostname(hostname: string): GuestLanguage | undefined {
  if (hostname === "traumabomen.nl" || hostname.endsWith(".traumabomen.nl")) return "nl";
  if (hostname === "traumatrees.org" || hostname.endsWith(".traumatrees.org")) return "en";
  return undefined;
}

/**
 * The guest page's first language: the host, then the browser's preferences,
 * then English. Nothing is read from or written to storage. The copy's own
 * language replaces it once the copy is open.
 */
export function detectGuestLanguage(
  hostname: string,
  browserLanguages: readonly string[],
): GuestLanguage {
  const fromHost = languageForHostname(hostname);
  if (fromHost) return fromHost;
  for (const language of browserLanguages) {
    const base = language.toLowerCase().split("-")[0];
    if (base === "en" || base === "nl") return base;
  }
  return "en";
}
