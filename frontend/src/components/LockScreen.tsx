import { Lock } from "lucide-react";
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
          <Lock size={24} aria-hidden="true" />
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
