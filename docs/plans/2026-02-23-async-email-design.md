# Async Email Sending Design

## Problem

The registration and resend-verification endpoints call `send_verification_email` synchronously, blocking the HTTP response on an SMTP connection. Under load or SMTP latency, this causes request timeouts and poor user experience. The waitlist and feedback endpoints already use ad-hoc `Thread(daemon=True)` wrappers, but there is no shared pattern and no retry logic.

## Solution

Introduce a single `send_email_background` helper in `app/email.py` that wraps any email-sending function in a daemon thread with one retry on failure. All four email call sites switch to this helper, making email sending consistently non-blocking across the codebase.

## Architecture

### Helper function

```python
def send_email_background(fn: Callable[..., None], *args: Any) -> None:
    def _worker() -> None:
        try:
            fn(*args)
        except Exception:
            time.sleep(5)
            try:
                fn(*args)
            except Exception:
                pass  # Already logged by each send_* function
    Thread(target=_worker, daemon=True).start()
```

Each `send_*` function already logs exceptions with `logger.exception(...)`. The retry produces a second log line on second failure. No extra logging needed in the wrapper.

### Call site changes (4 total)

| Call site | Current behavior | New behavior |
|-----------|-----------------|--------------|
| `auth.py` register (line 132) | Blocking `send_verification_email(...)`, 500 on failure | `send_email_background(send_verification_email, ...)`, returns immediately |
| `auth.py` resend (line 250) | Blocking `send_verification_email(...)`, 500 on failure | `send_email_background(send_verification_email, ...)`, returns immediately |
| `waitlist.py` approve (line 129) | Ad-hoc `Thread(target=send_waitlist_approval_email, ...)` | `send_email_background(send_waitlist_approval_email, ...)`, adds retry |
| `feedback.py` submit (line 37) | Ad-hoc `Thread(target=send_feedback_email, ...)` | `send_email_background(send_feedback_email, ...)`, adds retry |

### Behavior changes

- **Registration/resend**: endpoint returns success immediately regardless of SMTP outcome. User has "resend verification" button as fallback.
- **Waitlist/feedback**: no visible behavior change (already fire-and-forget); adds one retry on transient SMTP failures.

### What stays the same

- All three `send_*` functions: unchanged (same SMTP logic, same logging)
- Email templates: unchanged
- Database operations: unchanged (commit happens before email send)

## Testing

### Unit tests (`tests/test_email.py`)

1. **Happy path**: `send_email_background(fn, ...)` calls `fn` with correct args
2. **Retry on first failure**: `fn` raises once then succeeds; assert called twice
3. **Give up after two failures**: `fn` raises both times; assert called exactly twice, no unhandled exception
4. **Thread is daemon**: spawned thread has `daemon=True`

Tests use `threading.Event` or `thread.join(timeout)` to synchronize with the background thread.

### Integration test adjustments

Existing auth/waitlist/feedback tests mock `send_verification_email` etc. Since `send_email_background` calls the function by reference (passed as argument), mocks that patch the function in `app.email` will work correctly.

## Not included

- **Persistent outbox/retry queue**: overkill for current scale; "resend" button covers the gap
- **Task queue (Celery/ARQ)**: unnecessary infrastructure for fire-and-forget emails
- **Email delivery tracking**: not needed at this stage
