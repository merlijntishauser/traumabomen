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
