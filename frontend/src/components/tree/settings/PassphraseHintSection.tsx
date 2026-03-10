import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getEncryptionSalt, updatePassphraseHint } from "../../../lib/api";

export function PassphraseHintSection() {
  const { t } = useTranslation();
  const [hint, setHint] = useState("");
  const [savedHint, setSavedHint] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getEncryptionSalt()
      .then((res) => {
        const h = res.passphrase_hint ?? "";
        setHint(h);
        setSavedHint(h);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const value = hint.trim() || null;
      await updatePassphraseHint(value);
      setSavedHint(hint.trim());
      setSuccess(true);
    } catch {
      setError(t("settings.hintError"));
    } finally {
      setSaving(false);
    }
  }

  const isDirty = hint !== savedHint;

  if (loading) return null;

  return (
    <div className="settings-panel__section">
      <h4 className="settings-panel__section-title">{t("settings.passphraseHint")}</h4>
      <p className="settings-panel__description">{t("settings.hintDescription")}</p>
      <input
        type="text"
        className="settings-panel__input"
        value={hint}
        onChange={(e) => {
          setHint(e.target.value);
          setSuccess(false);
        }}
        maxLength={255}
        placeholder={t("auth.hintPlaceholder")}
      />
      {error && <p className="auth-error">{error}</p>}
      {success && <p className="auth-success">{t("settings.hintSaved")}</p>}
      <button
        type="button"
        className="settings-panel__btn"
        onClick={handleSave}
        disabled={saving || !isDirty}
      >
        {saving ? t("common.saving") : t("common.save")}
      </button>
    </div>
  );
}
