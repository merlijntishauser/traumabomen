# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

One product on two surfaces. The web app (`frontend/`, React) is where a tree is built: full editing of persons, relationships, events, patterns, timeline, journal, and insights. The iOS reflection companion (`mobile/ios`, SwiftUI over a Kotlin Multiplatform core in `mobile/core`) is the quiet place to read and write: it reads the whole tree, writes only the reflective layer (journal entries, turning points, trauma and life events), works offline, and points the user back to the desktop for tree structure. Each surface follows its own platform's design language; an Android app on the same core is planned, not started.

## Users

Two primary audiences, both first-class:

- **Individuals reflecting on their own family.** Adults mapping intergenerational patterns (loss, abuse, addiction, war, displacement, illness, poverty) onto their own family tree, usually alone, in private and often emotionally heavy moments. Many are in or near a therapy process. Their job: see their family more clearly, name what repeats, and write about it.
- **Clinicians working with clients.** Therapists and similar professionals who use the tree with a client, as homework or as a conversation piece. Today they reach the product through the client's own account; clinician-facing capabilities (read-only sharing, care-provider nodes, print/PDF export) are on the roadmap, not shipped.

## Product Purpose

A personal reflection tool for mapping intergenerational trauma onto a visual family tree, with everything encrypted on the user's device. It exists because genealogy tools assume one shape of family and clinical genogram tools are built for practitioners and store readable data on someone else's server. Success means a person can build a tree that matches their real family, record what happened in those lives, see the patterns across generations, and trust that no one else can read it.

Current phase (as of 2026-10): feature-rich private beta capped at 100 active users with a waitlist. The open question is no longer which feature is missing but what is required to let real people in and keep their data safe: mobile use, passphrase-loss mitigation, in-app onboarding, then read-only sharing.

## Positioning

Zero-knowledge encryption combined with structured trauma mapping on a family tree. The server stores only ciphertext; neither the operator nor anyone with server access can read a tree. No genogram tool (GenogramAI, GenoPro, Genograms.com, Genogram Analytics, GenoTool) combines interactive tree building, a structured trauma and life-event model, and zero-knowledge storage, and the clinical ones are practitioner-first. Traumatrees is reflection-first and does not claim to be therapy. See `docs/background/competitive-landscape.md`.

## Operating Context

- Users build on desktop and read or write on the phone; the web app currently shows phone users a banner recommending desktop inside the app (public pages and the demo already work on phones).
- Sessions are private and can be emotionally heavy; the app includes an onboarding safety acknowledgment, a mental-health support banner, a lock screen, and auto-lock.
- Every session starts with an encryption passphrase (with an optional plaintext hint) separate from the login password. On iOS the key is Secure Enclave-wrapped with biometric unlock and a weekly passphrase re-verify.
- A therapist may be looking at the same screen as the user during a session.
- Bilingual: English (Traumatrees, traumatrees.org) and Dutch (Traumabomen, traumabomen.nl).

## Capabilities and Constraints

- **Shipped (web):** auth with email verification, waitlist with admin approval, multiple trees, persons with typed relationships (biological, step, adoptive parent; sibling, step-sibling; partner with temporal periods; friend; inferred half-siblings), sibling groups, trauma events, life events, DSM-5 classifications (suspected or diagnosed, with periods), turning points, patterns linking entities across generations, React Flow canvas, D3 generational timeline, pattern view, journal with guided prompts, personal insights, user data export, feature flags, admin dashboard, public pages (landing, `/learn`, `/tour`, `/security`, `/privacy`, read-only `/demo`).
- **iOS companion:** biometric unlock, offline read of the whole tree, offline writes to the reflective layer, local reminders, read-only pinch-zoom canvas with native person pages.
- **Hard constraints:** all sensitive fields encrypted client-side (AES-256-GCM, Argon2id); the key lives only in memory on web; the backend is an opaque document store with no domain logic. Lost passphrase means lost data, by design.
- **Terminology:** persons, relationships, trauma events, life events, classifications, patterns, turning points, sibling groups, journal entries. Product name is Traumatrees in English and Traumabomen in Dutch.
- **Not shipped / undecided:** tree sharing, care providers, recovery codes, in-app first-run onboarding, canvas annotations, PDF export, an accessible non-canvas alternative view, Android app.

## Brand Commitments

- Calm, plainspoken, slightly fragile, never urgent. A reflection tool, not therapy and not crisis support.
- Voice: "you" and "your"; "we" only for technical guarantees. Lead with reassurance, follow with proof. Hard truths stated plainly and never softened ("If you lose your passphrase, your data is unrecoverable. This is by design."). Reflection prompts are open questions, never imperatives. No exclamation marks except genuine good news. No emoji anywhere. Sentence case for every label. EN and NL stay in lockstep with an equally restrained Dutch voice.
- An existing, documented visual system lives in `docs/design_handoff/` and `frontend/src/styles/theme.css`; it is binding for web work unless a redesign is explicitly requested.

## Evidence on Hand

- **Real product imagery:** landing screenshots and the read-only `/demo` tree; `demo/` holds the Playwright demo script, screenshots, and a voiceover script.
- **Founder story:** "Why Traumatrees exists" on the landing (`landing.founderTitle` / `landing.founderBody1-3`, signed Merlijn): a family too complex for genealogy tools, and notes about a family's hardest moments that should not live readable on someone else's server.
- **Security proof:** the encryption design itself (Argon2id, AES-256-GCM, zero-knowledge) and the public `/security` page.
- **Absent, never to be fabricated:** user testimonials or quotes, clinician or researcher endorsements, user counts, outcome or efficacy claims, press, certifications (including HIPAA), and pricing.

## Product Principles

1. **Privacy is the product, not a feature.** Nothing readable leaves the device, and every surface should make that legible without making it frightening.
2. **Real families, not ideal ones.** The model must be able to say what actually happened: step-parents, second marriages, half-siblings, adoption, two mothers. Never force one family shape.
3. **Reflection, not treatment.** Support seeing and naming patterns; never diagnose, prescribe, or imply clinical outcomes. Safety cues are present and quiet.
4. **Build at the desk, reflect anywhere.** Structure is built on the larger screen; the phone is for reading, writing, and returning.
5. **Useful in the room with a therapist.** What a user builds alone should hold up when shown to a clinician, without the product becoming practitioner software.

## Accessibility & Inclusion

- Sensitive subject matter: no attention-seeking motion, honor reduced motion, keep safety resources reachable.
- The React Flow canvas is hard for screen readers; an accessible list or timeline alternative is a known gap to close before any public, non-beta launch.
- Full EN and NL parity. On iOS, Dynamic Type and Dark Mode are required.
- No formal WCAG conformance level has been committed to yet.
