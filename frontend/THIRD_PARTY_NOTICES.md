# Third-party notices

Material bundled with the frontend that is not covered by the project licence.

## EFF large wordlist

- File: `src/lib/wordlists/eff-large.txt`
- Used for: guest link passphrases (`src/lib/passphraseWords.ts`)
- Source: Electronic Frontier Foundation, "EFF's New Wordlists for Random Passphrases" (2016)
- URL: https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt
  (SHA-256 of the downloaded file: `addd35536511597a02fa0a9ff1e5284677b8883b83e986e43f15a3db996b903e`)
- Licence: Creative Commons Attribution 3.0 United States (CC BY 3.0 US),
  https://creativecommons.org/licenses/by/3.0/us/
- Changes: the dice numbers were removed, leaving one word per line. Four
  hyphenated words were replaced, because the passphrase is normalised by
  turning hyphens into spaces: `drop-down` became `dropdown`, `felt-tip`
  became `felttip`, `t-shirt` became `tshirt`, and `yo-yo` became
  `yodeler` (`yoyo` is already in the list). The list stays at 7776 unique
  words.

## Dutch passphrases

No 7776-word Dutch list was found whose licence clearly permits bundling: the
Diceware Dutch list is GPL or unstated, and the frequency-based lists derive
from sources of unknown licence. Dutch-speaking owners therefore get
passphrases from the EFF large wordlist as well.
