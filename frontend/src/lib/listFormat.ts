/** Conjunction list formatters ("A, B and C"), one per supported language. */
const FORMATTERS = {
  en: new Intl.ListFormat("en", { type: "conjunction" }),
  nl: new Intl.ListFormat("nl", { type: "conjunction" }),
};

export function conjunctionFormatter(language: string): Intl.ListFormat {
  return language.startsWith("nl") ? FORMATTERS.nl : FORMATTERS.en;
}
