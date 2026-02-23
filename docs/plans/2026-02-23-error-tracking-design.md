# Production Error Tracking Design

## Problem

At 20 users, Cloud Run logs are sufficient for debugging. At 100+, unstructured logs become unmanageable. There is no error aggregation, no alerting on error rate spikes, and no way to monitor encryption-related failures specifically. Issues only surface when users report them.

## Solution

Integrate Sentry (SaaS, sentry.io) for both the FastAPI backend and the React frontend. Add custom encryption error types to distinguish passphrase failures from data corruption. Configure privacy safeguards to maintain zero-knowledge guarantees.

## Architecture

### Two SDKs, one Sentry project

- **Backend**: `sentry-sdk[fastapi]` (Python). Initialized in `app/main.py` before FastAPI app creation.
- **Frontend**: `@sentry/react` + `@sentry/vite-plugin`. Initialized in `main.tsx` before `ReactDOM.createRoot()`.
- Both report to the same Sentry project with separate environments (`production-api`, `production-frontend`).

### Configuration

| Variable | Where | Purpose |
|----------|-------|---------|
| `SENTRY_DSN` | Backend env (Secret Manager) | Backend SDK initialization |
| `VITE_SENTRY_DSN` | Frontend build arg | Baked into JS bundle (DSNs are public by design) |
| `SENTRY_AUTH_TOKEN` | GitHub Actions secret | Source map upload during build |
| `SENTRY_ORG` | GitHub Actions secret | Sentry organization slug |
| `SENTRY_PROJECT` | GitHub Actions secret | Sentry project slug |
| `SENTRY_ENVIRONMENT` | Both (set to `production`) | Environment tag |
| `SENTRY_RELEASE` | Both (set to git SHA) | Release tracking |

When `SENTRY_DSN` is empty (local dev default), both SDKs skip initialization entirely.

### What gets captured automatically

- Unhandled exceptions (both)
- Unhandled promise rejections (frontend)
- HTTP 500 responses (backend)
- Slow transactions at 10% sample rate (both)
- Health check transactions are filtered out

## Backend integration

### `app/main.py`

```python
import sentry_sdk

dsn = settings.SENTRY_DSN
if dsn:
    sentry_sdk.init(
        dsn=dsn,
        environment=settings.SENTRY_ENVIRONMENT,
        release=settings.SENTRY_RELEASE,
        traces_sample_rate=0.1,
        send_default_pii=False,
        before_send=_strip_encrypted_data,
    )
```

### Privacy hook

```python
def _strip_encrypted_data(event, hint):
    """Remove encrypted_data from request body context."""
    request_data = event.get("request", {}).get("data")
    if isinstance(request_data, dict):
        for key in list(request_data.keys()):
            if "encrypted" in key.lower():
                request_data[key] = "[filtered]"
    return event
```

### Settings additions (`app/config.py`)

```python
SENTRY_DSN: str = ""
SENTRY_ENVIRONMENT: str = "development"
SENTRY_RELEASE: str = ""
```

## Frontend integration

### `main.tsx`

```typescript
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || "development",
    release: import.meta.env.VITE_SENTRY_RELEASE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.reactRouterV7BrowserTracingIntegration({ ... }),
    ],
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      // Strip any breadcrumb data that could contain decrypted content
      if (event.breadcrumbs) {
        for (const crumb of event.breadcrumbs) {
          if (crumb.data && typeof crumb.data === "object") {
            for (const key of Object.keys(crumb.data)) {
              if (key.includes("encrypt") || key.includes("passphrase")) {
                crumb.data[key] = "[filtered]";
              }
            }
          }
        }
      }
      return event;
    },
  });
}
```

### Error boundary

Wrap the app in `Sentry.ErrorBoundary` in `App.tsx`:

```tsx
<Sentry.ErrorBoundary fallback={<ErrorFallback />}>
  <RouterProvider router={router} />
</Sentry.ErrorBoundary>
```

The `ErrorFallback` component shows a user-friendly "Something went wrong" message with a reload button.

### Source maps

The `@sentry/vite-plugin` is added to `vite.config.ts`:

```typescript
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  build: { sourcemap: true },
  plugins: [
    // ... existing plugins
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
});
```

Source maps are uploaded to Sentry during the Docker production build but NOT included in the nginx image (Sentry plugin deletes them after upload by default).

### User identity

Set to a hashed user ID (not email) to maintain privacy:

```typescript
Sentry.setUser({ id: sha256(userId) });
```

Called after successful login/unlock. Cleared on logout.

## Custom encryption error types

### Error hierarchy (`frontend/src/lib/crypto.ts`)

```
CryptoError (base, new)
  ├── DecryptError        (existing, reparented)
  ├── KeyDerivationError  (new: argon2/WASM failures)
  └── PassphraseError     (new: wrong passphrase on unlock)
```

```typescript
export class CryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CryptoError";
  }
}

export class DecryptError extends CryptoError {
  constructor() {
    super("Failed to decrypt data. Wrong passphrase or corrupted data.");
    this.name = "DecryptError";
  }
}

export class KeyDerivationError extends CryptoError {
  constructor(cause?: unknown) {
    super("Failed to derive encryption key.");
    this.name = "KeyDerivationError";
    this.cause = cause;
  }
}

export class PassphraseError extends CryptoError {
  constructor() {
    super("Incorrect passphrase.");
    this.name = "PassphraseError";
  }
}
```

### Where errors are thrown

- `deriveKey()`: wraps argon2 call in try/catch, throws `KeyDerivationError` on failure
- `decrypt()`: continues throwing `DecryptError` as today
- `EncryptionContext.verifyPassphrase()`: throws `PassphraseError` when test decryption fails after fresh key derivation
- `UnlockPage`: catches `PassphraseError` specifically for user message, reports others to Sentry

### Sentry tagging

All crypto errors are tagged before capture:

```typescript
Sentry.withScope((scope) => {
  scope.setTag("domain", "crypto");
  Sentry.captureException(error);
});
```

This enables filtering in Sentry: `domain:crypto`.

## Alerting

- **Default**: Sentry's built-in "Alert on first seen issue" (email notification)
- **Custom**: "When events tagged `domain:crypto` exceed 5 in 1 hour, alert immediately"
- No Slack/PagerDuty integration needed at this scale
- Configured manually in Sentry UI after initial deployment

## Deployment changes

### GitHub Actions (`deploy.yml`)

Add to the frontend build step:

```yaml
- name: Build frontend
  env:
    VITE_SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
    VITE_SENTRY_ENVIRONMENT: production
    VITE_SENTRY_RELEASE: ${{ github.sha }}
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
    SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
```

Add to backend Cloud Run service env vars:

```yaml
--set-secrets=SENTRY_DSN=sentry-dsn:latest
--set-env-vars=SENTRY_ENVIRONMENT=production,SENTRY_RELEASE=${{ github.sha }}
```

### `.env.example` additions

```
SENTRY_DSN=
SENTRY_ENVIRONMENT=development
SENTRY_RELEASE=
VITE_SENTRY_DSN=
```

## Testing

### Backend

- Test that `_strip_encrypted_data` hook removes `encrypted_data` keys from event context
- Test that Sentry init is skipped when DSN is empty
- Existing tests unaffected (Sentry SDK is a no-op without DSN)

### Frontend

- Test `CryptoError` hierarchy: `PassphraseError instanceof CryptoError`, etc.
- Test `ErrorFallback` component renders reload button
- Test that existing `DecryptError` behavior is preserved
- Existing tests unaffected (Sentry SDK is a no-op without DSN)

## Not included

- Performance monitoring dashboards
- Session replay
- Profiling
- Custom Sentry dashboards (beyond saved `domain:crypto` search)
- Backend structured logging (JSON format); Cloud Run's default log capture is sufficient
