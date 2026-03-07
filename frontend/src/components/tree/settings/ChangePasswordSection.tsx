import { useState } from "react";
import { useTranslation } from "react-i18next";
import { changePassword } from "../../../lib/api";
import { getPasswordStrength } from "../../../lib/passwordStrength";
import { PasswordStrengthMeter } from "../../PasswordStrengthMeter";

export function ChangePasswordSection() {
  const { t } = useTranslation();

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [pwLoading, setPwLoading] = useState(false);

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
    try {
      await changePassword({ current_password: pwCurrent, new_password: pwNew });
      setPwMessage({ type: "success", text: t("account.passwordChanged") });
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
    } catch {
      setPwMessage({ type: "error", text: t("account.passwordError") });
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="settings-panel__section">
      <h4 className="settings-panel__section-title">{t("account.changePassword")}</h4>
      {pwMessage && (
        <div className={`settings-panel__message settings-panel__message--${pwMessage.type}`}>
          {pwMessage.text}
        </div>
      )}
      <input
        type="password"
        className="settings-panel__input"
        placeholder={t("account.currentPassword")}
        value={pwCurrent}
        onChange={(e) => setPwCurrent(e.target.value)}
        autoComplete="current-password"
      />
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
      <input
        type="password"
        className="settings-panel__input"
        placeholder={t("account.confirmNewPassword")}
        value={pwConfirm}
        onChange={(e) => setPwConfirm(e.target.value)}
        autoComplete="new-password"
      />
      <button
        type="button"
        className="settings-panel__btn"
        disabled={
          !pwCurrent ||
          !pwNew ||
          !pwConfirm ||
          pwLoading ||
          getPasswordStrength(pwNew).level === "weak"
        }
        onClick={handleChangePassword}
      >
        {t("common.save")}
      </button>
    </div>
  );
}
