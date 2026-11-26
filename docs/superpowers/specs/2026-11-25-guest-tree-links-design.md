# Guest links: show a tree to someone without an account

## Why

The owner wants to show a tree to their therapist without making her create an
account. She must be able to view, click around and read. The owner decides what
she sees and for how long, and can tell whether the link is being used.

"Guest" below means anyone holding a link and its passphrase.

## Goals

- A guest opens a published, read-only copy of one tree with a link plus a
  passphrase. No account, no email address, no install.
- The server never holds anything that lets it read the copy.
- The owner can update, extend, unlock and end a link, and can see how often it
  was opened, when last, from how many networks, and how many wrong passphrases
  were tried.

## Non-goals

- Guest editing, or editing of any shared tree. Editing needs an account and is
  a separate project.
- Turning a guest link into an account share. The owner uses the existing share.
- Leaving out people or events. The format must not prevent it later.
- iOS.

## Anti-goals

- A link that works without the passphrase, or the passphrase without the link.
- A usage display that reads as "how many people". It counts networks.
- Storing the guest's address, location, device or a browser identifier.

## Approaches considered

- **A. Link plus passphrase, encrypted copy on our server. Chosen by the user.**
  Can expire, be ended and be updated. Costs the most work and adds the first
  endpoint where a stranger can request tree data.
- **B. Link only.** Simplest for the guest, but anyone who obtains the link can
  read everything. Rejected.
- **C. Encrypted file.** No server, but cannot expire, be ended or be updated,
  and allows unlimited offline guessing. Rejected.

Decided by the user earlier: a copy the owner publishes rather than a live view;
7 days by default, 30 at most; a usage count including distinct IP addresses.

## Threat model

| Attacker has | Outcome |
|---|---|
| Link only (forwarded message, browser history) | Cannot open. Online guesses are capped; the server releases no ciphertext without proof. |
| Passphrase only | Cannot open, cannot find the link. |
| Our database | No link secret (256 random bits), so nothing to attack. |
| Our database and the tree key | Recovers the link and passphrase through `owner_blob`. Anyone who was given the tree as an account share, removed or not, has held that key. They could already decrypt the live tree from the same database, so this adds nothing beyond it. |
| Database and link | Offline guessing at Argon2id cost against about 64 bits. |
| Link and passphrase | Can open until expiry or until ended. Usage figures may reveal it. |

Not protected: screenshots or copying by the guest, malware on either device, a
compromised server serving page code that steals the secrets (already true of
the whole app), and anyone in the tree who did not agree to being shown.

## Cryptography

Generated in the owner's browser, per link:

- `linkSecret`: 32 random bytes, base64url, carried in the URL fragment:
  `{origin}/view#{linkSecret}`. Nothing else identifies the link in the URL, so
  servers, proxies and link previews see only `/view`.
- `passphrase`: five words drawn with `crypto.getRandomValues` and rejection
  sampling from a 7776-word list (EN or NL by owner language), about 64 bits.
  Generated only; the owner cannot choose one. Normalise before use: NFKC,
  lowercase, hyphens and whitespace runs to one space, trim.

Derivation, identical on both sides:

    linkId = HKDF-SHA256(linkSecret, info "traumabomen/guest/v1/id", 16 bytes)
    salt   = HKDF-SHA256(linkSecret, info "traumabomen/guest/v1/salt", 16 bytes)
    pass   = Argon2id(passphrase, salt; t=3, m=64 MiB, p=1, 32 bytes)
    root   = linkSecret || pass
    encKey = HKDF-SHA256(root, info "traumabomen/guest/v1/enc", 32 bytes)
    token  = HKDF-SHA256(root, info "traumabomen/guest/v1/auth", 32 bytes)

HKDF salt is empty throughout. The salt derives from the link, so nothing has to
be fetched before the passphrase is entered. The server stores SHA-256(token)
and compares in constant time. `encKey` is non-extractable AES-256-GCM.

The copy is one JSON document, encrypted as a whole with a fresh 12-byte IV on
every publish and AAD `"traumabomen/guest/v1/" + base64url(linkId)`. The tree key
is never in the copy, the link or the guest's browser.

The owner's browser keeps `{ linkSecret, passphrase, label }` encrypted under the
tree key as `owner_blob`, so the link can be shown and updated later and survives
a passphrase change. Only the owner's endpoints return it.

## The copy

`{ version: 1, publishedAt, language, treeName, persons, relationships, events,
lifeEvents, turningPoints, classifications, patterns, siblingGroups }`, built
from freshly fetched data. Never the journal. If any entity fails to load or
decrypt, publishing stops with an error rather than publishing part of a tree.
Each entity is projected through an explicit list of fields, so a field
added to the app later is not published by accident. Limit 5 MB of ciphertext, with
`client_max_body_size` raised for only the publishing routes. Publishing is always an explicit click. Editing the
tree never changes the copy.

## Server

`guest_links`: id, tree_id and owner_id (cascade), link_id (unique), token_hash,
ciphertext, owner_blob, created_at, published_at, expires_at, failed_streak,
failed_total, open_count, last_opened_at.

`guest_link_networks`: link (cascade), network_hash, unique together. At most 100
rows per link; the UI then shows "100 or more".

Owner endpoints, owner only, under `/trees/{id}/guest-links`: list, create,
republish (ciphertext, published_at), set expiry, unlock (failed_streak to 0),
delete. At most 5 live links per tree. Creating and republishing require the new
`guest_links` flag, seeded `disabled`; listing and ending always work.

Guest endpoint: `POST /guest/open` with `{ link_id, token }` in the body.

- Unknown, expired or ended: 404 `not_available`, all alike.
- Locked (failed_streak >= 10): 423 `locked`, before the token is checked.
- Wrong token: 401 `wrong_passphrase`, failed_streak and failed_total + 1.

The whole check holds a row lock on the link (`SELECT ... FOR UPDATE`), from
reading failed_streak to writing the outcome, so parallel guesses queue and
cannot pass the cap. The 100-network cap runs under the same lock; the 5-link cap
locks the tree row. Neither list nor token check loads `ciphertext` (the API has
256 MiB); it is read only after a correct token.
- Correct: failed_streak to 0, open_count + 1, last_opened_at, network recorded,
  return the ciphertext.

**Kill switch.** `POST /guest/open`, create, republish, extend and unlock all
require the link owner to have the `guest_links` flag at that moment. Switching it
to `disabled` stops every link at once and deletes nothing; opens return
`not_available`. Listing and ending always work, so the share dialog appears when
either sharing flag is on or the tree has links.

Failure counts live in the database: the existing limiter is in memory and there
are up to four API instances. Keep the per-address limiter as well, and the
nginx API limit. Responses are `Cache-Control: no-store`.

**Expiry.** The owner picks 1, 7, 14 or 30 days; 7 is preselected. Extending
sets a new date, never more than 30 days ahead of that moment. The 30 days cap
each extension, not the link's whole life (owner's decision), so a guest can keep
one link and passphrase through a longer period while the owner renews it. The server
refuses from the expiry moment on. Expired rows, with ciphertext and usage, are
deleted by a sweep that runs on guest opens, owner listing and login.

## Usage

Shown per link: times opened, last opened, networks, wrong passphrases. Only a
successful open counts, so previews, mail scanners and crawlers cannot add to it.

A network is an IPv4 address or an IPv6 /64. Stored only as HMAC-SHA256 under a
subkey derived from the server secret, over link id and network. A plain hash
would be reversible by trying every IPv4 address; without the server secret the
database alone does not give addresses back, and hashes cannot be matched across
links. They are deleted with the link. No addresses are written to app logs.

The owner sees a line explaining the number: one person can use several networks
(home, phone, work), several people can share one, and a VPN changes it. The
guest is told on the page, before opening, that the sharer can see when it was
last opened, how often and from how many networks.

### Hosting logs

Owner's decision: hosting logs keep no trace of a guest visit, because a logged
address and user agent next to "last opened" would undo the hashing.

- nginx: `access_log off` for `/view` and the guest API paths.
- API: no uvicorn access log line for `/guest/*`; Sentry events from guest
  routes carry no client address or user agent (with a test).
- Cloud Run request logs: a Cloud Logging exclusion in GCP for the guest API
  paths, `/view`, and the requests the guest page makes for its own assets.
  Giving the guest bundle its own asset prefix makes that filter possible; if
  it cannot be separated, exclude all frontend request logs. The owner adds the
  exclusion; the `guest_links` flag stays off until it is in place and checked.
- Error logs nginx writes anyway are not access logs and hold no request
  addresses for normal traffic; the privacy policy says that hosting errors may
  be logged briefly.

### Prerequisite: an address that cannot be faked

`get_client_ip` takes the left-most X-Forwarded-For entry. The caller supplies
that, so anyone can forge it, through nginx or by calling the API directly, and
the API service is publicly reachable. For this feature a leaked-link holder
could appear as one network however many they use. It also weakens today's
per-IP login limits.

Fix: nginx sends its resolved `$remote_addr` in X-Real-IP plus a shared secret
header (new secret on both services, via envsubst like `API_URL`; widen
`NGINX_ENVSUBST_FILTER`). All four proxying nginx locations always overwrite both
headers. The API marks the address verified only when the secret matches, in
constant time, the current or the previous value (so it can be rotated).

This feature records a network only from a verified address; otherwise the figure
shows as unavailable. Rate limits use the verified address when there is one and
**otherwise keep today's behaviour**. They must never fall back to the right-most
entry: for proxied traffic that is our own frontend, and the API deploys before
the frontend, so everyone would share one login limit during a rollout. The API
logs a warning, without the address, when unverified traffic arrives.
Refusing unverified traffic, which closes the hole fully for login limits too, is
a later step once the warning stays silent.

The secret header is stripped from Sentry events and transactions, with a test:
the SDK's own list does not cover custom headers.

Creating the secret and checking with a forged header are steps in production
that the owner must do or approve. Until then, or if the visitor's address turns
out not to reach nginx, the feature ships with networks unavailable.

## The guest page

A separate HTML entry (`view.html`, served at `/view`), not a route in the main
app, which starts Sentry and loads Google Fonts on every page.

- No Sentry, no Google Fonts, no third-party request. System fonts are fine.
- Own nginx location with the full header set: CSP without sentry.io and
  Google hosts, `connect-src 'self'`, `form-action 'none'`; `Referrer-Policy:
  no-referrer`; `X-Robots-Tag: noindex`; `Cache-Control: no-store`.
- Read the fragment, then immediately `history.replaceState` it away. The
  browser's history may still keep the original URL, which is why the passphrase
  exists. Reloading asks for the original link again.
- Nothing in localStorage, sessionStorage, IndexedDB or cookies, including the
  i18n language cache. Existing theme settings may be read.
- Secrets and data are dropped on `pagehide` and after 15 idle minutes.
- A check on the production build, where the Sentry plugin runs, fails if the
  guest entry loads Sentry or the API auth client.
- `/view.html`, `/view/` and any other spelling redirect to `/view` or return 404,
  so the weaker headers or the main app never serve this page.
- The decrypted copy is untrusted input: `/view` shares an origin with the main
  app, and any account holder can craft a copy. Validate it against a strict
  schema before rendering: version, types, allowlisted enums and colours, string
  lengths and counts. Reject the whole copy on any mismatch.

Flow: a short explanation and the usage notice, passphrase field, Open. Then
canvas, person pages, timeline and patterns, all read-only, with "View only,
published {date}". No export, journal, settings or links into the app. Existing
read-only components are reused through in-memory data, as the public demo does;
anything that needs the API or EncryptionContext must be decoupled first.

States: no fragment, malformed link, wrong passphrase, locked, not available,
too many requests, offline, copy cannot be decrypted.

## The owner's side

In the existing share dialog, a "Share by link" section:

    Share by link
    For someone without an account. They see a copy you publish.
    For (only you see this)  [ Therapist        ]
    Lasts                    [ 7 days         v ]
    12 people, 34 events, 3 patterns. Not your journal.
    [ Create link ]

    Therapist                     until 2 December
    Link        traumatrees.org/view#…      [ Copy ]
    Passphrase  five words here             [ Copy ]
    Send these two separately.
    Published 25 November         [ Update what they see ]
    Opened 3 times, last on 28 November, from 2 networks.
    1 wrong passphrase.
    [ Extend ]  [ End link ]

There is no combined copy button and no send button. Ending asks to confirm and
says it cannot undo what was already seen. Copy follows AGENTS.md, EN and NL in
lockstep; "they", not "she".

## Documents

Privacy policy (guest data, networks, retention), `/security` page, SECURITY.md
(threat model above, and correct the existing line saying opened data "stays on
their device"), AGENTS.md, roadmap.

## Tests that must exist

- Fixed vectors for every derivation; wrong link, wrong passphrase, changed
  AAD and tampered ciphertext all fail; IV differs per publish.
- The copy never contains journal data or a tree key; a failed decrypt aborts.
- On Postgres: parallel wrong guesses cannot exceed the cap; locked refuses a right token;
  expired refuses before the sweep; unknown, expired and ended are identical.
- Owner isolation on every owner endpoint; account-share recipients get 404.
- Network counting: same, different, IPv6 /64, cap, no raw address stored,
  forged headers ignored both through nginx and directly, secret mismatch and
  rotation. Header tests run against the production image.
- Kill switch; malformed and hostile copies are rejected without rendering.
- Guest page: no storage writes, no third-party requests, fragment cleared,
  secrets dropped. Guest requests leave no nginx or API access log line. E2E: publish, open, read, update, extend, end, expire, lock.

## Left to the builder

Component decoupling, word lists (licence must permit bundling; note it),
file layout, exact copy, migration details, styling within the design system.
