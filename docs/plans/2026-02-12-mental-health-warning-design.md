# Mental Health Warning

## Context

Traumabomen deals with sensitive topics (trauma, abuse, addiction, loss) that may be triggering. A visible warning with links to crisis resources ensures users know where to find support.

## Design

### Dismissible banner (top of every page)

A `<MentalHealthBanner>` component rendered above the main content in `App.tsx`. Shows a single-line bar with a brief warning and a link to a locale-specific crisis resource. A close button hides the banner and persists the dismissal in `localStorage`.

### Footer line (always visible)

The `AppFooter` component gains a short "Need support?" text with the same crisis resource link. This remains visible after the banner is dismissed, providing a persistent fallback.

### Crisis resources by locale

| Locale | Resource | URL |
|--------|----------|-----|
| nl | Wij zijn Mind | https://wijzijnmind.nl |
| en | Crisis Text Line | https://www.crisistextline.org |

Unknown locales fall back to the English resource.

### i18n

Translation strings use the `Trans` component with a `<link>` interpolation tag and a `{{resource}}` variable for the organisation name.

## Files

- `frontend/src/components/MentalHealthBanner.tsx` -- banner component
- `frontend/src/components/MentalHealthBanner.css` -- banner styles
- `frontend/src/components/AppFooter.tsx` -- footer addition
- `frontend/src/styles/footer.css` -- footer style for new element
- `frontend/src/App.tsx` -- mounts the banner
- `frontend/src/locales/en/translation.json` -- English strings
- `frontend/src/locales/nl/translation.json` -- Dutch strings
