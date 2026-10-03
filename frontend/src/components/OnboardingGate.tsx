import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { acknowledgeOnboarding, setOnboardingFlag } from "../lib/api";
import "./OnboardingGate.css";

interface Props {
  onAcknowledged: () => void;
  /** Called after acknowledging when the user chose to start with the demo tree. */
  onStartDemo?: () => void;
  /** Exit without acknowledging. Escape is blocked, so this is the way out. */
  onLogout?: () => void;
}

export function OnboardingGate({ onAcknowledged, onStartDemo, onLogout }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    // showModal focuses the first focusable element (a link halfway down).
    // Start at the title so the gate is read from the top.
    titleRef.current?.focus();
  }, []);

  async function handleContinue(startDemo: boolean) {
    setLoading(true);
    try {
      await acknowledgeOnboarding();
    } catch {
      // The server save failed. Do not trap the user behind the gate: let
      // them in for this session. The server still has no acknowledgement,
      // so the gate shows again on the next login.
      setOnboardingFlag(true);
    }
    if (startDemo) onStartDemo?.();
    onAcknowledged();
  }

  return (
    <dialog
      ref={dialogRef}
      className="onboarding-gate"
      aria-labelledby="onboarding-gate-title"
      onCancel={(e) => e.preventDefault()}
    >
      <div className="onboarding-gate__card">
        <h1
          id="onboarding-gate-title"
          ref={titleRef}
          tabIndex={-1}
          className="onboarding-gate__title"
        >
          {t("app.title")}
        </h1>

        <div className="onboarding-gate__block">
          <h2 className="onboarding-gate__block-title">{t("safety.onboarding.whatThisIs")}</h2>
          <p className="onboarding-gate__block-body">{t("safety.onboarding.whatThisIsBody")}</p>
        </div>

        <div className="onboarding-gate__block">
          <h2 className="onboarding-gate__block-title">
            {t("safety.onboarding.whatThisMayBringUp")}
          </h2>
          <p className="onboarding-gate__block-body">
            {t("safety.onboarding.whatThisMayBringUpBody")}{" "}
            <a
              href="/support"
              target="_blank"
              rel="noopener noreferrer"
              className="onboarding-gate__link"
            >
              {t("safety.onboarding.supportLink")}
            </a>
          </p>
        </div>

        <div className="onboarding-gate__block">
          <h2 className="onboarding-gate__block-title">{t("safety.onboarding.tryDemo")}</h2>
          <p className="onboarding-gate__block-body">{t("safety.onboarding.tryDemoBody")}</p>
          {onStartDemo && (
            <button
              type="button"
              className="onboarding-gate__secondary"
              onClick={() => handleContinue(true)}
              disabled={loading}
            >
              {t("safety.onboarding.startWithDemo")}
            </button>
          )}
        </div>

        <div className="onboarding-gate__block">
          <h2 className="onboarding-gate__block-title">{t("safety.onboarding.whatWeCannotSee")}</h2>
          <p className="onboarding-gate__block-body">
            {t("safety.onboarding.whatWeCannotSeeBody")}{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="onboarding-gate__link"
            >
              {t("safety.footer.privacy")}
            </a>
          </p>
        </div>

        <button
          type="button"
          className="onboarding-gate__continue"
          onClick={() => handleContinue(false)}
          disabled={loading}
        >
          {t("safety.onboarding.continue")}
        </button>

        {onLogout && (
          <button
            type="button"
            className="onboarding-gate__exit"
            onClick={onLogout}
            disabled={loading}
          >
            {t("safety.onboarding.notNow")}
          </button>
        )}
      </div>
    </dialog>
  );
}
