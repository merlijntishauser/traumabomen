# UX-3: Password / Passphrase Visibility Toggle

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add show/hide visibility toggles to all 15 password and passphrase input fields across 8 components.

**Architecture:** Two reusable components (`PasswordInput` and `PassphraseInput`) that wrap a standard `<input>` in a positioned container with an eye/eye-off toggle button. `PassphraseInput` is a thin wrapper around `PasswordInput` that adds `data-1p-ignore` and passphrase-specific aria labels. Both components forward refs and pass through all standard input props.

**Tech Stack:** React, TypeScript, lucide-react (Eye/EyeOff icons), react-i18next, CSS custom properties.

---

## Chunk 1: Components, CSS, translations, and integration

### Task 1: Add i18n translation keys

**Files:**
- Modify: `frontend/public/locales/en/translation.json`
- Modify: `frontend/public/locales/nl/translation.json`

- [ ] **Step 1: Add English translation keys**

Add after the `"common.notAvailable"` key:

```json
"common.showPassword": "Show password",
"common.hidePassword": "Hide password",
"common.showPassphrase": "Show passphrase",
"common.hidePassphrase": "Hide passphrase",
```

- [ ] **Step 2: Add Dutch translation keys**

Add in the same position in the Dutch file:

```json
"common.showPassword": "Wachtwoord tonen",
"common.hidePassword": "Wachtwoord verbergen",
"common.showPassphrase": "Wachtwoordzin tonen",
"common.hidePassphrase": "Wachtwoordzin verbergen",
```

- [ ] **Step 3: Commit**

```bash
git add frontend/public/locales/en/translation.json frontend/public/locales/nl/translation.json
git commit -m "feat: add i18n keys for password/passphrase visibility toggle"
```

---

### Task 2: Create PasswordInput component + CSS

**Files:**
- Create: `frontend/src/components/PasswordInput.tsx`
- Create: `frontend/src/components/PasswordInput.css`
- Create: `frontend/src/components/PasswordInput.unit.test.ts`
- Create: `frontend/src/components/PasswordInput.test.tsx`

- [ ] **Step 1: Write the unit test for toggle state logic**

Create `frontend/src/components/PasswordInput.unit.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("PasswordInput toggle logic", () => {
  it("initial type is password (visible=false)", () => {
    const visible = false;
    expect(visible ? "text" : "password").toBe("password");
  });

  it("toggled type is text (visible=true)", () => {
    const visible = true;
    expect(visible ? "text" : "password").toBe("text");
  });
});
```

- [ ] **Step 2: Run unit test to verify it passes**

Run: `docker compose exec frontend npx vitest run --project unit -- PasswordInput.unit`
Expected: PASS

- [ ] **Step 3: Write the integration test**

Create `frontend/src/components/PasswordInput.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { PasswordInput } from "./PasswordInput";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

describe("PasswordInput", () => {
  it("renders a password input by default", () => {
    render(<PasswordInput value="" onChange={() => {}} />);
    const input = screen.getByRole("textbox", { hidden: true }) as HTMLInputElement | null;
    // Password inputs don't have the textbox role, so find by type
    const passwordInput = document.querySelector("input") as HTMLInputElement;
    expect(passwordInput.type).toBe("password");
  });

  it("toggles to text input when eye button is clicked", async () => {
    const user = userEvent.setup();
    render(<PasswordInput value="secret" onChange={() => {}} />);

    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("password");

    const toggleBtn = screen.getByRole("button", { name: "common.showPassword" });
    await user.click(toggleBtn);

    expect(input.type).toBe("text");
  });

  it("toggles back to password when clicked again", async () => {
    const user = userEvent.setup();
    render(<PasswordInput value="secret" onChange={() => {}} />);

    const toggleBtn = screen.getByRole("button", { name: "common.showPassword" });
    await user.click(toggleBtn);

    const hideBtn = screen.getByRole("button", { name: "common.hidePassword" });
    await user.click(hideBtn);

    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("forwards ref to the input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<PasswordInput ref={ref} value="" onChange={() => {}} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.tagName).toBe("INPUT");
  });

  it("passes through className to the input", () => {
    render(<PasswordInput className="custom-class" value="" onChange={() => {}} />);
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.classList.contains("custom-class")).toBe(true);
  });

  it("passes through id and placeholder", () => {
    render(<PasswordInput id="test-pw" placeholder="Enter password" value="" onChange={() => {}} />);
    const input = document.querySelector("#test-pw") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.placeholder).toBe("Enter password");
  });

  it("toggle button has type=button to prevent form submission", () => {
    render(<PasswordInput value="" onChange={() => {}} />);
    const toggleBtn = screen.getByRole("button", { name: "common.showPassword" });
    expect(toggleBtn.getAttribute("type")).toBe("button");
  });

  it("calls onChange when typing", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<PasswordInput value="" onChange={handleChange} />);

    const input = document.querySelector("input") as HTMLInputElement;
    await user.type(input, "a");
    expect(handleChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Create the CSS file**

Create `frontend/src/components/PasswordInput.css`:

```css
.password-input {
  position: relative;
}

.password-input__toggle {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: var(--transition-colors);
  height: auto;
}

.password-input__toggle:hover {
  color: var(--color-text-secondary);
}

.password-input__toggle:focus-visible {
  outline: 2px solid var(--color-accent-focus-ring);
  outline-offset: 1px;
}
```

- [ ] **Step 5: Create the PasswordInput component**

Create `frontend/src/components/PasswordInput.tsx`:

```tsx
import { Eye, EyeOff } from "lucide-react";
import { type ComponentProps, forwardRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./PasswordInput.css";

interface PasswordInputProps extends Omit<ComponentProps<"input">, "type"> {
  showLabel?: string;
  hideLabel?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ showLabel, hideLabel, style, ...props }, ref) {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);

    const show = showLabel ?? t("common.showPassword");
    const hide = hideLabel ?? t("common.hidePassword");
    const Icon = visible ? EyeOff : Eye;

    return (
      <div className="password-input">
        <input
          ref={ref}
          {...props}
          type={visible ? "text" : "password"}
          style={{ ...style, paddingRight: 36 }}
        />
        <button
          type="button"
          className="password-input__toggle"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hide : show}
          tabIndex={-1}
        >
          <Icon size={16} aria-hidden="true" />
        </button>
      </div>
    );
  },
);
```

- [ ] **Step 6: Run integration test to verify it passes**

Run: `docker compose exec frontend npx vitest run --project integration -- PasswordInput.test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/PasswordInput.tsx frontend/src/components/PasswordInput.css frontend/src/components/PasswordInput.unit.test.ts frontend/src/components/PasswordInput.test.tsx
git commit -m "feat: add PasswordInput component with visibility toggle"
```

---

### Task 3: Create PassphraseInput component

**Files:**
- Create: `frontend/src/components/PassphraseInput.tsx`
- Create: `frontend/src/components/PassphraseInput.test.tsx`

- [ ] **Step 1: Write the integration test**

Create `frontend/src/components/PassphraseInput.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { PassphraseInput } from "./PassphraseInput";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

describe("PassphraseInput", () => {
  it("renders a password input by default", () => {
    render(<PassphraseInput value="" onChange={() => {}} />);
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("has data-1p-ignore attribute", () => {
    render(<PassphraseInput value="" onChange={() => {}} />);
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.dataset["1pIgnore"]).toBeDefined();
  });

  it("uses passphrase-specific aria labels", async () => {
    const user = userEvent.setup();
    render(<PassphraseInput value="secret" onChange={() => {}} />);

    const toggleBtn = screen.getByRole("button", { name: "common.showPassphrase" });
    expect(toggleBtn).toBeTruthy();

    await user.click(toggleBtn);
    expect(screen.getByRole("button", { name: "common.hidePassphrase" })).toBeTruthy();
  });

  it("forwards ref to the input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<PassphraseInput ref={ref} value="" onChange={() => {}} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("passes through additional props", () => {
    render(<PassphraseInput id="pp" placeholder="Enter passphrase" value="" onChange={() => {}} />);
    const input = document.querySelector("#pp") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.placeholder).toBe("Enter passphrase");
  });
});
```

- [ ] **Step 2: Create the PassphraseInput component**

Create `frontend/src/components/PassphraseInput.tsx`:

```tsx
import { type ComponentProps, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { PasswordInput } from "./PasswordInput";

type PassphraseInputProps = Omit<ComponentProps<typeof PasswordInput>, "showLabel" | "hideLabel">;

export const PassphraseInput = forwardRef<HTMLInputElement, PassphraseInputProps>(
  function PassphraseInput(props, ref) {
    const { t } = useTranslation();
    return (
      <PasswordInput
        ref={ref}
        data-1p-ignore
        showLabel={t("common.showPassphrase")}
        hideLabel={t("common.hidePassphrase")}
        {...props}
      />
    );
  },
);
```

- [ ] **Step 3: Run integration test to verify it passes**

Run: `docker compose exec frontend npx vitest run --project integration -- PassphraseInput.test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/PassphraseInput.tsx frontend/src/components/PassphraseInput.test.tsx
git commit -m "feat: add PassphraseInput component wrapping PasswordInput with passphrase defaults"
```

---

### Task 4: Integrate into LoginPage

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx:63-70`

- [ ] **Step 1: Replace the password input**

Replace the `<input id="password" type="password" ...>` (lines 63-70) with:

```tsx
<PasswordInput
  id="password"
  required
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  data-1p-allow
/>
```

Add import: `import { PasswordInput } from "../components/PasswordInput";`

- [ ] **Step 2: Run existing tests**

Run: `docker compose exec frontend npx vitest run -- LoginPage`
Expected: PASS (LoginPage has no test file, so this is a no-op check)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx
git commit -m "feat: use PasswordInput with visibility toggle in LoginPage"
```

---

### Task 5: Integrate into RegisterPage

**Files:**
- Modify: `frontend/src/pages/RegisterPage.tsx`

- [ ] **Step 1: Replace password inputs in AccountStepForm**

Replace the two `<input type="password" ...>` elements (lines 125-135 and 141-154) with `PasswordInput`:

```tsx
<PasswordInput
  id="password"
  required
  maxLength={64}
  value={password}
  onChange={(e) =>
    dispatch({ type: "SET_FIELD", field: "password", value: e.target.value })
  }
  data-1p-allow
/>
```

```tsx
<PasswordInput
  id="confirmPassword"
  required
  value={confirmPassword}
  onChange={(e) =>
    dispatch({
      type: "SET_FIELD",
      field: "confirmPassword",
      value: e.target.value,
    })
  }
  data-1p-allow
/>
```

- [ ] **Step 2: Replace passphrase inputs in EncryptionStepForm**

Replace the two `<input type="password" ...>` elements (lines 200-210 and 216-229) with `PassphraseInput`:

```tsx
<PassphraseInput
  id="passphrase"
  required
  minLength={8}
  value={passphrase}
  onChange={(e) =>
    dispatch({ type: "SET_FIELD", field: "passphrase", value: e.target.value })
  }
/>
```

```tsx
<PassphraseInput
  id="confirmPassphrase"
  required
  value={confirmPassphrase}
  onChange={(e) =>
    dispatch({
      type: "SET_FIELD",
      field: "confirmPassphrase",
      value: e.target.value,
    })
  }
/>
```

Add imports:
```tsx
import { PasswordInput } from "../components/PasswordInput";
import { PassphraseInput } from "../components/PassphraseInput";
```

- [ ] **Step 3: Run existing tests**

Run: `docker compose exec frontend npx vitest run -- RegisterPage`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/RegisterPage.tsx
git commit -m "feat: use PasswordInput and PassphraseInput in RegisterPage"
```

---

### Task 6: Integrate into UnlockPage

**Files:**
- Modify: `frontend/src/pages/UnlockPage.tsx:137-144`

- [ ] **Step 1: Replace the passphrase input**

Replace the `<input id="passphrase" type="password" ...>` (lines 137-144) with:

```tsx
<PassphraseInput
  id="passphrase"
  required
  value={form.passphrase}
  onChange={(e) => dispatch({ type: "SET_PASSPHRASE", passphrase: e.target.value })}
/>
```

Add import: `import { PassphraseInput } from "../components/PassphraseInput";`

- [ ] **Step 2: Run existing tests**

Run: `docker compose exec frontend npx vitest run -- UnlockPage`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/UnlockPage.tsx
git commit -m "feat: use PassphraseInput in UnlockPage"
```

---

### Task 7: Integrate into ResetPasswordPage

**Files:**
- Modify: `frontend/src/pages/ResetPasswordPage.tsx:88-105`

- [ ] **Step 1: Replace the password inputs**

Replace the two `<input type="password" ...>` elements (lines 88-94 and 99-105) with:

```tsx
<PasswordInput
  id="new-password"
  required
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>
```

```tsx
<PasswordInput
  id="confirm-password"
  required
  value={confirm}
  onChange={(e) => setConfirm(e.target.value)}
/>
```

Add import: `import { PasswordInput } from "../components/PasswordInput";`

- [ ] **Step 2: Run existing tests**

Run: `docker compose exec frontend npx vitest run -- ResetPasswordPage`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ResetPasswordPage.tsx
git commit -m "feat: use PasswordInput in ResetPasswordPage"
```

---

### Task 8: Integrate into AuthModal

**Files:**
- Modify: `frontend/src/components/AuthModal.tsx:236-244,261-271`

- [ ] **Step 1: Replace the password input in credentials step**

Replace the `<input id="auth-modal-password" type="password" ...>` (lines 236-244) with:

```tsx
<PasswordInput
  id="auth-modal-password"
  required
  value={state.password}
  onChange={(e) =>
    dispatch({ type: "SET_FIELD", field: "password", value: e.target.value })
  }
/>
```

- [ ] **Step 2: Replace the passphrase input in passphrase step**

Replace the `<input id="auth-modal-passphrase" type="password" ...>` (lines 261-271) with:

```tsx
<PassphraseInput
  ref={showCredentials ? undefined : inputRef}
  id="auth-modal-passphrase"
  required
  value={state.passphrase}
  onChange={(e) =>
    dispatch({ type: "SET_FIELD", field: "passphrase", value: e.target.value })
  }
/>
```

Add imports:
```tsx
import { PasswordInput } from "./PasswordInput";
import { PassphraseInput } from "./PassphraseInput";
```

- [ ] **Step 3: Run existing tests**

Run: `docker compose exec frontend npx vitest run -- AuthModal`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AuthModal.tsx
git commit -m "feat: use PasswordInput and PassphraseInput in AuthModal"
```

---

### Task 9: Integrate into LockScreen

**Files:**
- Modify: `frontend/src/components/LockScreen.tsx:95-103`

- [ ] **Step 1: Replace the passphrase input**

Replace the `<input ref={inputRef} type="password" ...>` (lines 95-103) with:

```tsx
<PassphraseInput
  ref={inputRef}
  className={`lock-screen__input${shaking ? " lock-screen__input--shake" : ""}`}
  value={passphrase}
  onChange={(e) => setPassphrase(e.target.value)}
  autoComplete="off"
/>
```

Add import: `import { PassphraseInput } from "./PassphraseInput";`

- [ ] **Step 2: Run existing tests and fix any that query `input[type='password']`**

Run: `docker compose exec frontend npx vitest run -- LockScreen.test`
Expected: Some tests may need updating if they query by `input[type='password']`.

Tests that query `document.querySelector("input[type='password']")` need to be changed to `document.querySelector("input")` since the type toggles. The input starts as `type="password"` so existing queries should still work. If tests click the toggle, the type changes.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/LockScreen.tsx
git commit -m "feat: use PassphraseInput in LockScreen"
```

---

### Task 10: Integrate into ChangePasswordSection

**Files:**
- Modify: `frontend/src/components/tree/settings/ChangePasswordSection.tsx:88-113`

- [ ] **Step 1: Replace the three password inputs**

Replace the three `<input type="password" ...>` elements (lines 88-113) with:

```tsx
<PasswordInput
  className="settings-panel__input"
  placeholder={t("account.currentPassword")}
  value={state.current}
  onChange={(e) => dispatch({ type: "SET_FIELD", field: "current", value: e.target.value })}
  autoComplete="current-password"
/>
```

```tsx
<PasswordInput
  className="settings-panel__input"
  placeholder={t("account.newPassword")}
  value={state.newPw}
  maxLength={64}
  onChange={(e) => dispatch({ type: "SET_FIELD", field: "newPw", value: e.target.value })}
  autoComplete="new-password"
/>
```

```tsx
<PasswordInput
  className="settings-panel__input"
  placeholder={t("account.confirmNewPassword")}
  value={state.confirm}
  onChange={(e) => dispatch({ type: "SET_FIELD", field: "confirm", value: e.target.value })}
  autoComplete="new-password"
/>
```

Add import: `import { PasswordInput } from "../../PasswordInput";`

- [ ] **Step 2: Run existing tests**

Run: `docker compose exec frontend npx vitest run -- ChangePasswordSection`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/tree/settings/ChangePasswordSection.tsx
git commit -m "feat: use PasswordInput in ChangePasswordSection"
```

---

### Task 11: Integrate into ChangePassphraseSection

**Files:**
- Modify: `frontend/src/components/tree/settings/ChangePassphraseSection.tsx:268-291`

- [ ] **Step 1: Replace the three passphrase inputs**

Replace the three `<input type="password" ...>` elements (lines 268-291) with:

```tsx
<PassphraseInput
  className="settings-panel__input"
  placeholder={t("account.currentPassphrase")}
  value={state.current}
  onChange={(e) => dispatch({ type: "SET_FIELD", field: "current", value: e.target.value })}
/>
```

```tsx
<PassphraseInput
  className="settings-panel__input"
  placeholder={t("account.newPassphrase")}
  value={state.newPp}
  onChange={(e) => dispatch({ type: "SET_FIELD", field: "newPp", value: e.target.value })}
/>
```

```tsx
<PassphraseInput
  className="settings-panel__input"
  placeholder={t("account.confirmNewPassphrase")}
  value={state.confirm}
  onChange={(e) => dispatch({ type: "SET_FIELD", field: "confirm", value: e.target.value })}
/>
```

Add import: `import { PassphraseInput } from "../../PassphraseInput";`

- [ ] **Step 2: Run existing tests**

Run: `docker compose exec frontend npx vitest run -- ChangePassphraseSection`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/tree/settings/ChangePassphraseSection.tsx
git commit -m "feat: use PassphraseInput in ChangePassphraseSection"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run all frontend tests**

Run: `docker compose exec frontend npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run TypeScript type check**

Run: `docker compose exec frontend npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Update roadmap**

In `docs/roadmap.md`, mark UX-3 as done by changing:
```
#### UX-3. No password / passphrase visibility toggle
```
to:
```
#### ~~UX-3. No password / passphrase visibility toggle~~ (done)
```

And update the description to past tense.

- [ ] **Step 4: Commit**

```bash
git add docs/roadmap.md
git commit -m "docs: mark UX-3 password visibility toggle as done"
```
