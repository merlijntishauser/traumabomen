# Privacy Policy Page

## Context

The app is a public product handling sensitive data in the EU. GDPR requires a privacy policy. The app's core selling point is zero-knowledge encryption, so the policy should reinforce that claim while being transparent about what metadata the server does see.

## Content Structure

The privacy policy covers eight sections:

1. **What we collect** -- email address (authentication), encrypted data blobs (persons, relationships, events, trees), encryption salt, login timestamps.
2. **What we cannot access** -- any content inside encrypted blobs. Names, relationships, trauma details are opaque to the server.
3. **How encryption works** -- non-technical explanation. Passphrase never leaves the device, key derived locally via Argon2id, data encrypted with AES-256-GCM before transmission.
4. **Hosting and infrastructure** -- Google Cloud Platform (Cloud Run, Cloud SQL). Email delivery via SMTP for verification emails.
5. **Cookies and local storage** -- no cookies, no analytics, no tracking, no third-party scripts. localStorage holds JWT auth tokens only.
6. **Data retention** -- data stored as long as the account exists. Account deletion removes everything.
7. **Your rights (GDPR)** -- access, rectification, erasure, portability, right to lodge a complaint with a supervisory authority. Contact info for requests.
8. **Contact** -- email address for privacy questions.

## Implementation

### Route and Component

- New public route: `/privacy`
- Component: `PrivacyPage.tsx` -- renders translated content as semantic HTML
- No auth required -- accessible before login, during registration, and when logged in
- Styled with `privacy.css`, reusing existing CSS variables

### Layout

- Centered content column, max-width ~700px for readability
- Same minimal chrome as login/register pages
- Back link to return to previous page
- Semantic HTML: `h1`, `h2`, `p` elements

### i18n

- All content in `privacy.*` namespace in translation files
- Each section heading and body paragraph gets its own key
- Supported: English (`en/translation.json`) and Dutch (`nl/translation.json`)

### Links to Privacy Page

- Login page: link below the "Your data stays yours" section
- Register page: same position
- Logged-in state: link in tree list page footer or toolbar

### Files to Create/Modify

| # | File | Change |
|---|------|--------|
| 1 | `frontend/src/pages/PrivacyPage.tsx` | New page component |
| 2 | `frontend/src/styles/privacy.css` | Page styling |
| 3 | `frontend/src/locales/en/translation.json` | English privacy content |
| 4 | `frontend/src/locales/nl/translation.json` | Dutch privacy content |
| 5 | `frontend/src/App.tsx` | Add `/privacy` route |
| 6 | `frontend/src/pages/LoginPage.tsx` | Add privacy link |
| 7 | `frontend/src/pages/RegisterPage.tsx` | Add privacy link |
| 8 | `frontend/src/pages/TreeListPage.tsx` | Add privacy link |
