import { Lock } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./LockScreen.css";
import { PassphraseInput } from "./PassphraseInput";

interface Props {
  wrongAttempts: number;
  onUnlock: (passphrase: string) => void;
  onLogout: () => void;
}

export function LockScreen({ wrongAttempts, onUnlock, onLogout }: Props) {
  const { t } = useTranslation();
  const [passphrase, setPassphrase] = useState("");
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevAttemptsRef = useRef(wrongAttempts);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Shake animation on wrong attempt (previous prop pattern)
  if (wrongAttempts > prevAttemptsRef.current) {
    prevAttemptsRef.current = wrongAttempts;
    setShaking(true);
    setPassphrase("");
    clearTimeout(shakeTimerRef.current);
    shakeTimerRef.current = setTimeout(() => setShaking(false), 400);
  }

  // Clean up shake timer on unmount
  useEffect(() => {
    return () => clearTimeout(shakeTimerRef.current);
  }, []);

  // Capture all keyboard events except those in the passphrase input
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target === inputRef.current) return;
      // Allow Escape to propagate (for double-Esc detection)
      if (e.key === "Escape") return;
      e.stopPropagation();
      e.preventDefault();
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!passphrase) return;
    onUnlock(passphrase);
  }

  return (
    <div
      className="lock-screen"
      role="dialog"
      aria-modal="true"
      aria-label={t("safety.lock.title")}
    >
      <div className="lock-screen__card">
        <picture>
          <source srcSet="/images/hero-unlock-dark.webp" type="image/webp" />
          <img
            className="lock-screen__bg lock-screen__bg--dark"
            src="/images/hero-unlock-dark.jpg"
            alt=""
            aria-hidden="true"
          />
        </picture>
        <picture>
          <source srcSet="/images/hero-unlock-light.webp" type="image/webp" />
          <img
            className="lock-screen__bg lock-screen__bg--light"
            src="/images/hero-unlock-light.jpg"
            alt=""
            aria-hidden="true"
          />
        </picture>
        <div className="lock-screen__content">
          <div className="lock-screen__icon">
            <Lock size={24} aria-hidden="true" />
          </div>
          <h2 className="lock-screen__title">{t("safety.lock.title")}</h2>
          <p className="lock-screen__subtitle">{t("safety.lock.passphrase")}</p>

          <form className="lock-screen__form" onSubmit={handleSubmit}>
            <div className="lock-screen__input-wrapper">
              <PassphraseInput
                ref={inputRef}
                className={`lock-screen__input${shaking ? " lock-screen__input--shake" : ""}`}
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="lock-screen__error" role="alert">
              {wrongAttempts > 0 && t("safety.lock.wrongPassphrase")}
            </div>
            <button type="submit" className="lock-screen__submit" disabled={!passphrase}>
              {t("safety.lock.unlock")}
            </button>
          </form>
          <button type="button" className="lock-screen__logout" onClick={onLogout}>
            {t("auth.switchAccount")}
          </button>
        </div>
      </div>
    </div>
  );
}
