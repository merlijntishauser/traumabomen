# Password Strength Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add password strength validation with a visual meter on register and password change, enforced on both client and server.

**Architecture:** A pure scoring function (length tiers + character diversity) implemented identically in TypeScript and Python. The frontend renders a three-segment strength meter below password inputs and blocks submission when weak. The backend rejects weak passwords at the register and change-password endpoints as defense-in-depth.

**Tech Stack:** React component + CSS, pure TypeScript/Python functions, Vitest, pytest. No new dependencies.

**Design doc:** `docs/plans/2026-02-26-password-strength-design.md`

---

### Task 1: Password strength scoring function (frontend)

**Files:**
- Create: `frontend/src/lib/passwordStrength.ts`
- Create: `frontend/src/lib/passwordStrength.test.ts`

**Step 1: Write the tests**

Create `frontend/src/lib/passwordStrength.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { getPasswordStrength } from "./passwordStrength";

describe("getPasswordStrength", () => {
  it("returns weak for empty string", () => {
    expect(getPasswordStrength("")).toEqual({ score: 0, level: "weak" });
  });

  it("returns weak for password shorter than 8 characters", () => {
    expect(getPasswordStrength("short")).toEqual({ score: 0, level: "weak" });
  });

  it("returns weak for 8 chars single lowercase (score 1)", () => {
    expect(getPasswordStrength("abcdefgh")).toEqual({ score: 1, level: "weak" });
  });

  it("returns weak for 8 chars with mixed case only (score 2)", () => {
    expect(getPasswordStrength("Abcdefgh")).toEqual({ score: 2, level: "weak" });
  });

  it("returns fair for 12 chars single case (score 3)", () => {
    expect(getPasswordStrength("abcdefghijkl")).toEqual({ score: 3, level: "fair" });
  });

  it("returns fair for 8 chars with mixed case and digit (score 3)", () => {
    expect(getPasswordStrength("Abcdefg1")).toEqual({ score: 3, level: "fair" });
  });

  it("returns strong for 12 chars with mixed case (score 4)", () => {
    expect(getPasswordStrength("Abcdefghijkl")).toEqual({ score: 4, level: "strong" });
  });

  it("returns strong for 16+ chars single case (score 4)", () => {
    expect(getPasswordStrength("abcdefghijklmnop")).toEqual({ score: 4, level: "strong" });
  });

  it("returns strong for 16+ chars with mixed case and digit (score 5)", () => {
    expect(getPasswordStrength("Abcdefghijklmno1")).toEqual({ score: 5, level: "strong" });
  });

  it("counts symbols as digit-or-symbol diversity", () => {
    expect(getPasswordStrength("abcdefg!")).toEqual({ score: 2, level: "weak" });
    expect(getPasswordStrength("abcdefghijk!")).toEqual({ score: 4, level: "strong" });
  });

  it("handles max length edge (64 chars)", () => {
    const result = getPasswordStrength("A1" + "a".repeat(62));
    expect(result.level).toBe("strong");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/lib/passwordStrength.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement the scoring function**

Create `frontend/src/lib/passwordStrength.ts`:

```typescript
export type PasswordLevel = "weak" | "fair" | "strong";

export interface PasswordStrength {
  score: number;
  level: PasswordLevel;
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (password.length < 8) {
    return { score: 0, level: "weak" };
  }

  let score = 1; // >= 8 chars
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  if (hasLower && hasUpper) score++;

  const hasDigitOrSymbol = /[\d\W_]/.test(password);
  if (hasDigitOrSymbol) score++;

  const level: PasswordLevel = score <= 2 ? "weak" : score === 3 ? "fair" : "strong";
  return { score, level };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/lib/passwordStrength.test.ts`
Expected: PASS (all 11 tests)

**Step 5: Commit**

```bash
git add frontend/src/lib/passwordStrength.ts frontend/src/lib/passwordStrength.test.ts
git commit -m "Add password strength scoring function"
```

---

### Task 2: Password strength meter component (frontend)

**Files:**
- Create: `frontend/src/components/PasswordStrengthMeter.tsx`
- Create: `frontend/src/components/PasswordStrengthMeter.css`
- Create: `frontend/src/components/PasswordStrengthMeter.test.tsx`
- Modify: `frontend/src/styles/theme.css:35-36` (add warning/success vars after danger block)
- Modify: `frontend/src/styles/theme.css:144-145` (add warning/success vars for light theme)

**Step 1: Add CSS variables to theme.css**

In `frontend/src/styles/theme.css`, after the `--color-danger-border` line in the dark theme (`:root`, line 35), add:

```css
  /* Warning + Success */
  --color-warning: #f59e0b;
  --color-success: #22c55e;
```

In the light theme (`[data-theme="light"]`, after line 144), add:

```css
  --color-warning: #d97706;
  --color-success: #16a34a;
```

**Step 2: Write the component tests**

Create `frontend/src/components/PasswordStrengthMeter.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

describe("PasswordStrengthMeter", () => {
  it("renders nothing when password is empty", () => {
    const { container } = render(<PasswordStrengthMeter password="" />);
    expect(container.firstChild).toBeNull();
  });

  it("shows weak label for a weak password", () => {
    render(<PasswordStrengthMeter password="abc" />);
    expect(screen.getByText("password.weak")).toBeInTheDocument();
  });

  it("shows weak label for 8 chars single case", () => {
    render(<PasswordStrengthMeter password="abcdefgh" />);
    expect(screen.getByText("password.weak")).toBeInTheDocument();
  });

  it("shows fair label for a fair password", () => {
    render(<PasswordStrengthMeter password="abcdefghijkl" />);
    expect(screen.getByText("password.fair")).toBeInTheDocument();
  });

  it("shows strong label for a strong password", () => {
    render(<PasswordStrengthMeter password="Abcdefghijkl" />);
    expect(screen.getByText("password.strong")).toBeInTheDocument();
  });

  it("renders three meter segments", () => {
    const { container } = render(<PasswordStrengthMeter password="abc" />);
    const segments = container.querySelectorAll(".password-meter__segment");
    expect(segments).toHaveLength(3);
  });

  it("applies the correct level class to the meter", () => {
    const { container } = render(<PasswordStrengthMeter password="Abcdefghijkl" />);
    const meter = container.querySelector(".password-meter");
    expect(meter?.classList.contains("password-meter--strong")).toBe(true);
  });
});
```

**Step 3: Run tests to verify they fail**

Run: `cd frontend && npx vitest run src/components/PasswordStrengthMeter.test.tsx`
Expected: FAIL (module not found)

**Step 4: Implement the component**

Create `frontend/src/components/PasswordStrengthMeter.tsx`:

```tsx
import { useTranslation } from "react-i18next";
import { getPasswordStrength } from "../lib/passwordStrength";
import "./PasswordStrengthMeter.css";

interface Props {
  password: string;
}

export function PasswordStrengthMeter({ password }: Props) {
  const { t } = useTranslation();

  if (!password) return null;

  const { level } = getPasswordStrength(password);

  return (
    <div className={`password-meter password-meter--${level}`}>
      <div className="password-meter__bar">
        <div className="password-meter__segment" />
        <div className="password-meter__segment" />
        <div className="password-meter__segment" />
      </div>
      <span className="password-meter__label">{t(`password.${level}`)}</span>
    </div>
  );
}
```

Create `frontend/src/components/PasswordStrengthMeter.css`:

```css
.password-meter {
  margin-top: 4px;
  margin-bottom: 4px;
}

.password-meter__bar {
  display: flex;
  gap: 3px;
  height: 4px;
}

.password-meter__segment {
  flex: 1;
  border-radius: 2px;
  background: var(--color-bg-tertiary);
  transition: background 0.15s ease;
}

/* Weak: first segment red */
.password-meter--weak .password-meter__segment:nth-child(1) {
  background: var(--color-danger);
}

/* Fair: first two segments amber */
.password-meter--fair .password-meter__segment:nth-child(1),
.password-meter--fair .password-meter__segment:nth-child(2) {
  background: var(--color-warning);
}

/* Strong: all three segments green */
.password-meter--strong .password-meter__segment {
  background: var(--color-success);
}

.password-meter__label {
  display: block;
  font-size: 11px;
  margin-top: 2px;
  color: var(--color-text-muted);
}

.password-meter--weak .password-meter__label {
  color: var(--color-danger);
}

.password-meter--fair .password-meter__label {
  color: var(--color-warning);
}

.password-meter--strong .password-meter__label {
  color: var(--color-success);
}
```

**Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/PasswordStrengthMeter.test.tsx`
Expected: PASS (all 7 tests)

**Step 6: Commit**

```bash
git add frontend/src/components/PasswordStrengthMeter.tsx frontend/src/components/PasswordStrengthMeter.css frontend/src/components/PasswordStrengthMeter.test.tsx frontend/src/styles/theme.css
git commit -m "Add password strength meter component with theme variables"
```

---

### Task 3: Integrate meter into RegisterPage

**Files:**
- Modify: `frontend/src/pages/RegisterPage.tsx:35-40` (validate function), `117-125` (password input), `179` (submit button)

**Step 1: Update RegisterPage**

In `frontend/src/pages/RegisterPage.tsx`:

1. Add import at top:
```typescript
import { PasswordStrengthMeter } from "../components/PasswordStrengthMeter";
import { getPasswordStrength } from "../lib/passwordStrength";
```

2. Update the `validate()` function (line 35-40). Add password strength check as the first validation:
```typescript
function validate(): string | null {
  if (getPasswordStrength(password).level === "weak") return t("auth.passwordTooWeak");
  if (password.length > 64) return t("auth.passwordTooLong");
  if (password !== confirmPassword) return t("auth.passwordMismatch");
  if (passphrase.length < 8) return t("auth.passphraseTooShort");
  if (passphrase !== confirmPassphrase) return t("auth.passphraseMismatch");
  if (!acknowledged) return t("auth.mustAcknowledgeWarning");
  return null;
}
```

3. Add `maxLength={64}` to the password input (line 117-124), and add `<PasswordStrengthMeter>` after the closing `</input>` but before the closing `</div>` of the auth-field:
```tsx
<div className="auth-field">
  <label htmlFor="password">{t("auth.password")}</label>
  <input
    id="password"
    type="password"
    required
    maxLength={64}
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    data-1p-allow
  />
  <PasswordStrengthMeter password={password} />
</div>
```

4. Update the submit button (line 179). Disable when password is weak:
```tsx
<button className="auth-submit" type="submit" disabled={loading || getPasswordStrength(password).level === "weak"}>
```

**Step 2: Run existing RegisterPage tests (if any) + type check**

There are no existing RegisterPage tests. Run type check:
Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/pages/RegisterPage.tsx
git commit -m "Add password strength meter to register page"
```

---

### Task 4: Integrate meter into SettingsPanel password change

**Files:**
- Modify: `frontend/src/components/tree/SettingsPanel.tsx:117-134` (handleChangePassword), `364-371` (new password input), `380-387` (save button)

**Step 1: Update SettingsPanel**

In `frontend/src/components/tree/SettingsPanel.tsx`:

1. Add imports at top:
```typescript
import { PasswordStrengthMeter } from "../PasswordStrengthMeter";
import { getPasswordStrength } from "../../lib/passwordStrength";
```

2. Update `handleChangePassword()` (line 117-135). Add strength check after the mismatch check:
```typescript
async function handleChangePassword() {
  setPwMessage(null);
  if (pwNew !== pwConfirm) {
    setPwMessage({ type: "error", text: t("account.passwordMismatch") });
    return;
  }
  if (getPasswordStrength(pwNew).level === "weak") {
    setPwMessage({ type: "error", text: t("auth.passwordTooWeak") });
    return;
  }
  setPwLoading(true);
  // ... rest unchanged
```

3. Add `maxLength={64}` to the new password input (line 364-371), and add `<PasswordStrengthMeter>` after it:
```tsx
<input
  type="password"
  className="settings-panel__input"
  placeholder={t("account.newPassword")}
  value={pwNew}
  maxLength={64}
  onChange={(e) => setPwNew(e.target.value)}
  autoComplete="new-password"
/>
<PasswordStrengthMeter password={pwNew} />
```

4. Update the save button disabled condition (line 380-387). Add weak password check:
```tsx
disabled={!pwCurrent || !pwNew || !pwConfirm || pwLoading || getPasswordStrength(pwNew).level === "weak"}
```

**Step 2: Run existing SettingsPanel tests + type check**

Run: `cd frontend && npx vitest run src/components/tree/SettingsPanel.test.tsx`
Expected: PASS (existing tests should still pass; the mock for PasswordStrengthMeter is not needed because the meter renders null for empty strings, and tests use empty default state)

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add frontend/src/components/tree/SettingsPanel.tsx
git commit -m "Add password strength meter to settings password change"
```

---

### Task 5: Add i18n translation keys

**Files:**
- Modify: `frontend/public/locales/en/translation.json`
- Modify: `frontend/public/locales/nl/translation.json`

**Step 1: Add English keys**

Add to the `password` namespace (new section) and `auth` namespace in `frontend/public/locales/en/translation.json`:

```json
"password": {
  "weak": "Weak",
  "fair": "Fair",
  "strong": "Strong"
},
```

Add to the existing `auth` section:
```json
"auth": {
  ...existing keys...
  "passwordTooWeak": "Password is too weak",
  "passwordTooLong": "Password must be 64 characters or fewer"
}
```

**Step 2: Add Dutch keys**

Add to `frontend/public/locales/nl/translation.json`:

```json
"password": {
  "weak": "Zwak",
  "fair": "Redelijk",
  "strong": "Sterk"
},
```

Add to the existing `auth` section:
```json
"auth": {
  ...existing keys...
  "passwordTooWeak": "Wachtwoord is te zwak",
  "passwordTooLong": "Wachtwoord mag maximaal 64 tekens bevatten"
}
```

**Step 3: Commit**

```bash
git add frontend/public/locales/en/translation.json frontend/public/locales/nl/translation.json
git commit -m "Add i18n keys for password strength validation"
```

---

### Task 6: Backend password strength validation

**Files:**
- Modify: `api/app/auth.py:17-23` (add check_password_strength after verify_password)
- Modify: `api/app/routers/auth.py:111-156` (register endpoint)
- Modify: `api/app/routers/auth.py:313-325` (change-password endpoint)
- Modify: `api/tests/test_auth.py` (add new test class + update existing tests)

**Step 1: Write the backend tests**

Add to `api/tests/test_auth.py`, after the `TestPasswordHashing` class (line 30):

```python
class TestPasswordStrength:
    def test_empty_password_is_weak(self):
        from app.auth import check_password_strength
        result = check_password_strength("")
        assert result["level"] == "weak"
        assert result["score"] == 0

    def test_short_password_is_weak(self):
        from app.auth import check_password_strength
        result = check_password_strength("short")
        assert result["level"] == "weak"
        assert result["score"] == 0

    def test_8_chars_single_case_is_weak(self):
        from app.auth import check_password_strength
        result = check_password_strength("abcdefgh")
        assert result["level"] == "weak"
        assert result["score"] == 1

    def test_8_chars_mixed_case_is_weak(self):
        from app.auth import check_password_strength
        result = check_password_strength("Abcdefgh")
        assert result["level"] == "weak"
        assert result["score"] == 2

    def test_12_chars_single_case_is_fair(self):
        from app.auth import check_password_strength
        result = check_password_strength("abcdefghijkl")
        assert result["level"] == "fair"
        assert result["score"] == 3

    def test_8_chars_mixed_case_digit_is_fair(self):
        from app.auth import check_password_strength
        result = check_password_strength("Abcdefg1")
        assert result["level"] == "fair"
        assert result["score"] == 3

    def test_12_chars_mixed_case_is_strong(self):
        from app.auth import check_password_strength
        result = check_password_strength("Abcdefghijkl")
        assert result["level"] == "strong"
        assert result["score"] == 4

    def test_16_chars_single_case_is_strong(self):
        from app.auth import check_password_strength
        result = check_password_strength("a" * 16)
        assert result["level"] == "strong"
        assert result["score"] == 4

    def test_16_chars_mixed_case_digit_is_max(self):
        from app.auth import check_password_strength
        result = check_password_strength("Abcdefghijklmno1")
        assert result["level"] == "strong"
        assert result["score"] == 5

    def test_symbols_count_as_digit_or_symbol(self):
        from app.auth import check_password_strength
        result = check_password_strength("abcdefg!")
        assert result["score"] == 2
```

Add to the `TestRegister` class, after the existing tests:

```python
    @pytest.mark.asyncio
    async def test_register_weak_password_rejected(self, client):
        resp = await client.post(
            "/auth/register",
            json={"email": "weak@example.com", "password": "abc", "encryption_salt": "salt"},
        )
        assert resp.status_code == 422
        assert resp.json()["detail"] == "password_too_weak"

    @pytest.mark.asyncio
    async def test_register_too_long_password_rejected(self, client):
        resp = await client.post(
            "/auth/register",
            json={"email": "long@example.com", "password": "a" * 65, "encryption_salt": "salt"},
        )
        assert resp.status_code == 422
        assert resp.json()["detail"] == "password_too_long"
```

Add to the `TestChangePassword` class, after the existing tests:

```python
    @pytest.mark.asyncio
    async def test_change_password_weak_rejected(self, client, user, headers):
        resp = await client.put(
            "/auth/password",
            json={"current_password": "password123", "new_password": "weak"},
            headers=headers,
        )
        assert resp.status_code == 422
        assert resp.json()["detail"] == "password_too_weak"

    @pytest.mark.asyncio
    async def test_change_password_too_long_rejected(self, client, user, headers):
        resp = await client.put(
            "/auth/password",
            json={"current_password": "password123", "new_password": "a" * 65},
            headers=headers,
        )
        assert resp.status_code == 422
        assert resp.json()["detail"] == "password_too_long"
```

**Step 2: Run tests to verify they fail**

Run: `docker compose exec api uv run pytest tests/test_auth.py -v -k "strength or weak or too_long"`
Expected: FAIL (check_password_strength not found, endpoints don't reject)

**Step 3: Implement backend validation**

In `api/app/auth.py`, add after `verify_password` (line 23):

```python
import re

def check_password_strength(password: str) -> dict[str, object]:
    if len(password) < 8:
        return {"score": 0, "level": "weak"}

    score = 1  # >= 8 chars
    if len(password) >= 12:
        score += 1
    if len(password) >= 16:
        score += 1

    has_lower = bool(re.search(r"[a-z]", password))
    has_upper = bool(re.search(r"[A-Z]", password))
    if has_lower and has_upper:
        score += 1

    if re.search(r"[\d\W_]", password):
        score += 1

    level = "weak" if score <= 2 else ("fair" if score == 3 else "strong")
    return {"score": score, "level": level}
```

In `api/app/routers/auth.py`, add import at line 11:
```python
from app.auth import check_password_strength, create_token, decode_token, get_current_user, hash_password, verify_password
```

In the `register` endpoint (after line 117, before the email normalization), add password validation:
```python
    if len(body.password) > 64:
        raise HTTPException(status_code=422, detail="password_too_long")
    if check_password_strength(body.password)["level"] == "weak":
        raise HTTPException(status_code=422, detail="password_too_weak")
```

In the `change_password` endpoint (after line 322, after verifying the current password), add:
```python
    if len(body.new_password) > 64:
        raise HTTPException(status_code=422, detail="password_too_long")
    if check_password_strength(body.new_password)["level"] == "weak":
        raise HTTPException(status_code=422, detail="password_too_weak")
```

**Step 4: Update existing test passwords that are now too weak**

Several existing tests use passwords that score "weak" (e.g. `"pass1234"` scores 2: length 8 + has digit = 2, which is weak). Update these:

In `api/tests/conftest.py` line 190, change the default password:
```python
password: str = "TestPassword1",
```

In `api/tests/test_auth.py`, update all `"pass1234"` to `"TestPassword1"` and all `"password123"` to `"TestPassword1"`. Also update `"newpass456"` to `"NewTestPass456"` and `"newpass"` to `"short"` (this one is testing wrong current password, so the new password value doesn't matter; but keep it consistent).

Similarly update password strings in `api/tests/test_waitlist.py` and `api/tests/test_rate_limiter_integration.py` to use `"TestPassword1"`.

**Important:** Only change passwords in API call payloads. The `create_user` helper hashes directly, bypassing endpoint validation, so its default also needs updating for login tests to match.

**Step 5: Run all backend tests**

Run: `docker compose exec api uv run pytest -v`
Expected: PASS

**Step 6: Run security check**

Run: `docker compose exec api uv run bandit -r app/`
Expected: No new findings

**Step 7: Commit**

```bash
git add api/app/auth.py api/app/routers/auth.py api/tests/test_auth.py api/tests/conftest.py api/tests/test_waitlist.py api/tests/test_rate_limiter_integration.py
git commit -m "Add server-side password strength validation"
```

---

### Task 7: Update roadmap and run full verification

**Files:**
- Modify: `docs/roadmap.md:135` (strike through password validation item)

**Step 1: Update roadmap**

In `docs/roadmap.md`, change line 135 from:
```
- Client-side and server-side password strength validation (minimum length, complexity)
```
to:
```
- ~~Client-side and server-side password strength validation (minimum length, complexity)~~
```

**Step 2: Run full frontend verification**

Run: `cd frontend && npx vitest run`
Expected: All tests pass

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Run full backend verification**

Run: `docker compose exec api uv run pytest`
Expected: All tests pass

Run: `docker compose exec api uv run mypy app/`
Expected: No errors

**Step 4: Commit**

```bash
git add docs/roadmap.md
git commit -m "Mark password strength validation as done in roadmap"
```
