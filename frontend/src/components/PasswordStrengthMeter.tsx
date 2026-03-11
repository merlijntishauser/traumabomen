import { Trans, useTranslation } from "react-i18next";
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
      {level !== "strong" && (
        <span className="password-meter__hint">
          <Trans
            i18nKey="password.hint"
            components={{
              "1PasswordLink": (
                // biome-ignore lint/a11y/useAnchorContent: Trans replaces children
                <a href="https://1password.com" target="_blank" rel="noopener noreferrer">
                  {" "}
                </a>
              ),
            }}
          />
        </span>
      )}
    </div>
  );
}
