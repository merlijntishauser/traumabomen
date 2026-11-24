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

There is currently no out-of-band check that a public key belongs to the intended person. Key fingerprint verification (comparing a short fingerprint over another channel) is a possible follow-up. Removing access stops new reads through the server, but anything a recipient has already opened stays on their device.
