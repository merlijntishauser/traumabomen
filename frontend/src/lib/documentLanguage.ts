/**
 * The value for <html lang> for an i18next language code. Screen readers pick
 * their voice from it, so Dutch content under lang="en" is read with English
 * pronunciation.
 */
export function htmlLangFor(language: string | undefined): "en" | "nl" {
  return language?.toLowerCase().startsWith("nl") ? "nl" : "en";
}
