---
target: landing page
total_score: 22
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 3
target_identity: "file:/Users/merlijn/Development/personal/traumabomen/frontend/src/pages/LandingPage.tsx"
target_fingerprint: "sha256:ed2d4fbd550d9adb6fab7d3d430225e0d82b7630067835d89e7cad845a44d55b"
target_path: /Users/merlijn/Development/personal/traumabomen/frontend/src/pages/LandingPage.tsx
timestamp: 2026-10-03T18-17-37Z
slug: frontend-src-pages-landingpage-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Private beta, 100-user cap, and waitlist never mentioned; capacity surfaces only after the full 3-step registration |
| 2 | Match System / Real World | 3 | Plain, warm language; "classifications" unexplained DSM jargon |
| 3 | User Control and Freedom | 3 | Nothing forced; demo and tour without an account |
| 4 | Consistency and Standards | 2 | Step titles render Playwrite at weight 600; light hero is a painted seascape, not forest; light-theme branch draws indigo diamonds |
| 5 | Error Prevention | 2 | Key loss warned up front; closed registration discovered only on final submit (RegisterPage.tsx:465) |
| 6 | Recognition Rather Than Recall | 3 | Badge legend in prose, a screen away from the screenshot it describes |
| 7 | Flexibility and Efficiency | n/a | Single-pass persuasion page, no repeat-use workflow |
| 8 | Aesthetic and Minimalist Design | 3 | Restrained; privacy restated 4x, "not therapy" 4x |
| 9 | Error Recovery | 2 | Waitlist page says only "We're currently at capacity"; no-JS render is blank |
| 10 | Help and Documentation | 3 | FAQ, learn, tour, demo, security, support all linked; FAQ ungrouped with a near-duplicate pair |
| **Total** | | **22/36** | **Acceptable** |

## Design Specificity Verdict
Content is specific (real tree screenshot, badge shape language, unsoftened key-loss truth, founder note with handwritten signature); structure is a calm-SaaS template (photo hero, framed screenshot, three numbered cards, shield illustration, two prose blocks, FAQ grid, centered CTA card). Light hero is an impressionist coastal painting, off-identity next to the dark forest. Detector: CLI 0 findings. Overlay 12/12/10: dark-glow, thin-border-wide-shadow, overused-font, shape-assembled-illustration are false positives under DESIGN.md; real: line-length (~86-89 chars, 65ch measures the 0 glyph), buried-raster (both hero themes download, ~320 KB wasted).

## Priority Issues
1. [P1] Beta, cap, and waitlist hidden; CTA overpromises. "Create your account" and "your account takes a minute to create" promise immediate access; RegisterPage has no capacity pre-check, so at capacity users set email, password, and encryption key before being bounced to /waitlist. Fix: public registration-status flag; CTAs become "Join the waitlist" when closed; one plain always-visible line about the small private beta; RegisterPage checks on mount; finalCtaBody true in both states. -> /impeccable harden
2. [P1] Clinicians, a primary audience, are invisible. whoBody addresses only individuals; FAQ "There is no sharing feature" reads as a dead end; /genogram is footer-only. Fix: one honest paragraph about using the tree in a session and sharing being planned; link /genogram; reframe the sharing FAQ. -> /impeccable clarify
3. [P1] Narrative order buries the founder story (8th, after a 7-item FAQ) and repeats privacy. Fix: Hero, What+Who, How, Privacy, Founder, FAQ (about 5, grouped tool/data, merge the two "who can see" items), Final. -> /impeccable layout
4. [P2] Mobile first viewport shows no product: hero art hidden at <=900px, scroll cue collides with the stacked CTAs, sticky footer takes 95px of 844, inline links 18-23px tall. Fix: cropped tree glimpse below CTAs on phones, hide scroll cue <=640px, non-sticky footer on public pages, 24px+ link targets. -> /impeccable adapt
5. [P2] System drift: .landing__step-title (landing.css:429) bold Playwrite; light hero painted seascape vs forest; indigo diamonds in the light GrowingBranch; light-theme hero lede 2.8:1 where it crosses the cliff; both hero images downloaded on every load, no srcset for phones; prose measure ~88 chars. -> /impeccable polish

## Persona Red Flags
Jordan: never learns it is a capped beta; "a minute" becomes a 3-step form with a second secret and possibly a waitlist wall; "classifications" opaque. Riley: blank page without JS; html lang stays "en" in Dutch; footer version "(unknown)". Casey: no product above the fold, 95px sticky footer, scroll cue over CTAs, 18-23px inline links. Therapist deciding whether to recommend: nothing addressed to them, "no sharing" without roadmap, unframed diagnoses wording, genogram angle footer-only. Night searcher after a family revelation: hero and "Nothing here is urgent." serve them; nothing previews that the app lets them pause, lock, and find support.

## Minor Observations
Hero glimpse cropped mid-edge; no skip link or nav landmark; 8rem Playwrite step numerals add a third handwriting use; NL footer "bijv." off-voice; pink "Reflection tool" pill off-palette; AGPL/GitHub open-source trust asset never mentioned on the page; hard-coded #f4efe6 hero text color; register step icon in a filled circle; hero LCP without fetchpriority or preload; glimpse-tree-light loads while hidden.

## Questions to Consider
- If the cap is the reality for now, should the primary CTA honestly be "Request access", making scarcity part of the calm?
- The founder story is the only human proof on hand. Why is it second to last instead of second?
- Would one honest sentence about using the tree in a session cost the individual reader anything?
- The code is AGPL and public. Is "you can read the code" stronger evidence for a zero-knowledge claim than a shield illustration?
