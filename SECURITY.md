# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Traumabomen, please report it responsibly by emailing **security@traumatrees.org**. Do not open a public GitHub issue for security vulnerabilities.

Please include:

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fix (optional)

## What to Expect

- **Acknowledgement** within 48 hours of your report.
- **Status updates** as we investigate and work on a fix.
- **Resolution** of critical vulnerabilities within 7 days where possible.

We ask that you give us reasonable time to address the issue before any public disclosure.

## Scope

The following areas are in scope:

- Authentication and authorization (JWT, session handling)
- Client-side encryption implementation (key derivation, AES-256-GCM)
- API endpoints and data validation
- Cross-site scripting (XSS), injection, and CSRF vulnerabilities
- Information leakage (plaintext data exposure, logging sensitive data)

The following are out of scope:

- Denial of service (DoS/DDoS) attacks
- Social engineering or phishing
- Vulnerabilities in third-party dependencies already tracked by Dependabot
- Issues requiring physical access to a user's device
- Rate limiting on non-authentication endpoints

## Recognition

We are happy to credit security researchers in our release notes (with your permission). As this is a personal project, there is no bug bounty program.

## Encryption Architecture

Traumabomen uses a zero-knowledge encryption model. All sensitive data is encrypted client-side with AES-256-GCM before reaching the server. The encryption key is derived from a user-provided passphrase via Argon2id and is never persisted or transmitted. The server stores only opaque ciphertext. For details, see [CLAUDE.md](CLAUDE.md#zero-knowledge-encryption-flow).

## Tree Sharing Trust Model

A tree can be shared read-only with another account. Each account has an RSA-OAEP (4096-bit) key pair; the private key is stored on the server encrypted under the account's master key, so the server cannot use it. To share, the owner's browser fetches the recipient's public key from the server, wraps the tree's AES-256 key with it, and uploads only the wrapped key. The server never sees a tree key in plaintext.

The weak point is the public key lookup. The owner's browser trusts whatever public key the server returns for an email address. A compromised or malicious server could substitute a key it controls and so obtain the tree keys of trees that are shared, and through them the contents of those trees. Trees that are never shared are not exposed this way. The same applies to pending invitations, which are completed automatically with the recipient's public key once they have set up their account.

There is currently no out-of-band check that a public key belongs to the intended person. Key fingerprint verification (comparing a short fingerprint over another channel) is a possible follow-up. Removing access stops new reads through the server. The app keeps opened data in memory only and writes none of it to browser storage, but nothing stops a recipient from having copied or photographed what they saw before access was removed.

## Guest Link Threat Model

An owner can publish an encrypted read-only copy of one tree for someone without an account (a guest). The guest opens `{origin}/view#{linkSecret}` and types a five word passphrase. Both are generated in the owner's browser. The copy is encrypted with AES-256-GCM under a key derived from the link secret and the passphrase (Argon2id and HKDF-SHA256), so the server holds ciphertext, a SHA-256 of the auth token, counters and dates, and keyed hashes of the networks that opened the link (an IPv4 address or an IPv6 /64, at most 100 per link, never raw addresses). A link is deleted when it is ended or expires (swept on guest opens, owner listing and login), and with the tree or the account. It can last 1, 7, 14 or 30 days and be extended, each extension at most 30 days ahead. It locks after 10 wrong passphrases and the owner can unlock it. A tree has at most 5 live links. The `guest_links` feature flag is a kill switch: with it off, every link stops answering and nothing is deleted.

| Attacker has | Outcome |
|---|---|
| Link only (forwarded message, browser history) | Cannot open. Online guesses are capped; the server releases no ciphertext without proof. |
| Passphrase only | Cannot open, cannot find the link. |
| Our database | No link secret (256 random bits), so nothing to attack. |
| Our database and the tree key | Recovers the link and passphrase through `owner_blob`. Anyone who was given the tree as an account share, removed or not, has held that key. They could already decrypt the live tree from the same database, so this adds nothing beyond it. |
| Database and link | Offline guessing at Argon2id cost against about 64 bits. |
| Link and passphrase | Can open until expiry or until ended. Usage figures may reveal it. |

Not protected: screenshots or copying by the guest, malware on either device, a compromised server serving page code that steals the secrets (already true of the whole app), and anyone in the tree who did not agree to being shown.

The guest page (`/view`) is a separate build with no Sentry, no Google Fonts, no third-party requests and no browser storage. It removes the fragment from the address bar right after reading it and drops secrets and data on `pagehide` and after 15 idle minutes. The nginx access log and the API access log keep no line for guest requests, and Sentry events from guest routes carry no address or user agent. Guest links are only switched on once the hosting platform's request logs for these pages are excluded, and the platform may still log errors briefly. An expired link stops working at once and is removed at the next sweep. The network count shows as unavailable until the proxy secret that lets the API trust the visitor's address is configured. The journal, the tree key and the master key are never part of the copy.
