import { type FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./LockScreen.css";

interface Props {
  wrongAttempts: number;
  onUnlock: (passphrase: string) => void;
}

export function LockScreen({ wrongAttempts, onUnlock }: Props) {
  const { t } = useTranslation();
  const [passphrase, setPassphrase] = useState("");
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevAttemptsRef = useRef(wrongAttempts);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Shake animation on wrong attempt
  useEffect(() => {
    if (wrongAttempts > prevAttemptsRef.current) {
      setShaking(true);
      setPassphrase("");
      const timer = setTimeout(() => setShaking(false), 400);
      prevAttemptsRef.current = wrongAttempts;
      return () => clearTimeout(timer);
    }
    prevAttemptsRef.current = wrongAttempts;
  }, [wrongAttempts]);

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
        <div className="lock-screen__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z" />
          </svg>
        </div>
        <h2 className="lock-screen__title">{t("safety.lock.title")}</h2>
        <p className="lock-screen__subtitle">{t("safety.lock.passphrase")}</p>

        <form className="lock-screen__form" onSubmit={handleSubmit}>
          <div className="lock-screen__input-wrapper">
            <input
              ref={inputRef}
              type="password"
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
      </div>
    </div>
  );
}
