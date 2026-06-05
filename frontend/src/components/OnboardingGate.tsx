import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { acknowledgeOnboarding } from "../lib/api";
import "./OnboardingGate.css";

interface Props {
  onAcknowledged: () => void;
}

export function OnboardingGate({ onAcknowledged }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  async function handleContinue() {
    setLoading(true);
    try {
      await acknowledgeOnboarding();
      onAcknowledged();
    } catch {
      // Silently retry -- not critical if server save fails;
      // the gate will just show again next login
      setLoading(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="onboarding-gate"
      aria-label={t("app.title")}
      onCancel={(e) => e.preventDefault()}
    >
      <div className="onboarding-gate__card">
        <h1 className="onboarding-gate__title">{t("app.title")}</h1>

        <div className="onboarding-gate__block">
          <h2 className="onboarding-gate__block-title">{t("safety.onboarding.whatThisIs")}</h2>
          <p className="onboarding-gate__block-body">{t("safety.onboarding.whatThisIsBody")}</p>
        </div>

        <div className="onboarding-gate__block">
          <h2 className="onboarding-gate__block-title">
            {t("safety.onboarding.whatThisMayBringUp")}
          </h2>
          <p className="onboarding-gate__block-body">
            {t("safety.onboarding.whatThisMayBringUpBody")}
          </p>
        </div>

        <div className="onboarding-gate__block">
          <h2 className="onboarding-gate__block-title">{t("safety.onboarding.tryDemo")}</h2>
          <p className="onboarding-gate__block-body">{t("safety.onboarding.tryDemoBody")}</p>
        </div>

        <div className="onboarding-gate__block">
          <h2 className="onboarding-gate__block-title">{t("safety.onboarding.whatWeCannotSee")}</h2>
          <p className="onboarding-gate__block-body">
            {t("safety.onboarding.whatWeCannotSeeBody")}{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="onboarding-gate__privacy-link"
            >
              {t("safety.footer.privacy")}
            </a>
          </p>
        </div>

        <button
          type="button"
          className="onboarding-gate__continue"
          onClick={handleContinue}
          disabled={loading}
        >
          {t("safety.onboarding.continue")}
        </button>
      </div>
    </dialog>
  );
}
