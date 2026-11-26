/** Small display helpers for the owner's guest link list. */

/** The link a guest opens: the secret lives only in the fragment, which never reaches a server. */
export function guestLinkUrl(origin: string, linkSecret: string): string {
  return `${origin}/view#${linkSecret}`;
}

const DAY_MONTH: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" };
const DAY_MONTH_YEAR: Intl.DateTimeFormatOptions = { ...DAY_MONTH, year: "numeric" };

const FORMATTERS = {
  en: {
    thisYear: new Intl.DateTimeFormat("en", DAY_MONTH),
    otherYear: new Intl.DateTimeFormat("en", DAY_MONTH_YEAR),
  },
  nl: {
    thisYear: new Intl.DateTimeFormat("nl", DAY_MONTH),
    otherYear: new Intl.DateTimeFormat("nl", DAY_MONTH_YEAR),
  },
};

/** "2 December", with the year only when it is not the current one. */
export function formatLinkDate(iso: string, language: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const formatters = FORMATTERS[guestLanguageOf(language)];
  const sameYear = date.getFullYear() === now.getFullYear();
  return (sameYear ? formatters.thisYear : formatters.otherYear).format(date);
}

/** The owner's language as a copy and passphrase language. */
export function guestLanguageOf(language: string): "en" | "nl" {
  return language.toLowerCase().startsWith("nl") ? "nl" : "en";
}
