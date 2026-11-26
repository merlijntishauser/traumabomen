/**
 * Guest link passphrases: five words from a 7776-word list, about 64 bits.
 *
 * No Dutch list with a licence that permits bundling was found, so both
 * languages draw from the EFF large wordlist (see THIRD_PARTY_NOTICES.md).
 */

export type PassphraseLanguage = "en" | "nl";

const WORD_COUNT = 7776;
const PASSPHRASE_WORDS = 5;
/** The largest multiple of WORD_COUNT below 2^32: draws at or above it are redrawn. */
const DRAW_LIMIT = Math.floor(2 ** 32 / WORD_COUNT) * WORD_COUNT;

const loadEffLarge = () => import("./wordlists/eff-large.txt?raw").then((m) => m.default);

const WORD_LISTS: Record<PassphraseLanguage, () => Promise<string>> = {
  en: loadEffLarge,
  nl: loadEffLarge,
};

function randomIndex(): number {
  const draw = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(draw);
    if (draw[0] < DRAW_LIMIT) return draw[0] % WORD_COUNT;
  }
}

export async function generatePassphrase(language: PassphraseLanguage): Promise<string> {
  const words = (await WORD_LISTS[language]()).split("\n").filter(Boolean);
  if (words.length !== WORD_COUNT) throw new Error("Passphrase word list has the wrong length.");
  return Array.from({ length: PASSPHRASE_WORDS }, () => words[randomIndex()]).join(" ");
}
