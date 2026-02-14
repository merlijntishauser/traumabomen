import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useEncryption } from "../../contexts/EncryptionContext";
import type { CanvasSettings, EdgeStyle } from "../../hooks/useCanvasSettings";
import { useLogout } from "../../hooks/useLogout";
import { useTheme } from "../../hooks/useTheme";
import {
  changePassword,
  deleteAccount,
  getEncryptionSalt,
  getEvents,
  getLifeEvents,
  getPersons,
  getRelationships,
  getTrees,
  syncTree,
  updateSalt,
} from "../../lib/api";
import { decryptFromApi, deriveKey, encryptForApi, generateSalt } from "../../lib/crypto";
import "./SettingsPanel.css";

interface Props {
  settings: CanvasSettings;
  onUpdate: (partial: Partial<CanvasSettings>) => void;
  className?: string;
}

const EDGE_STYLES: EdgeStyle[] = ["curved", "elbows", "straight"];

export function SettingsPanel({ settings, onUpdate, className }: Props) {
  const { t, i18n } = useTranslation();
  const { theme, toggle: toggleTheme } = useTheme();
  const { setKey } = useEncryption();
  const logout = useLogout();

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const [tab, setTab] = useState<"canvas" | "account">("canvas");

  // Password change state
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [pwLoading, setPwLoading] = useState(false);

  // Passphrase change state
  const [ppCurrent, setPpCurrent] = useState("");
  const [ppNew, setPpNew] = useState("");
  const [ppConfirm, setPpConfirm] = useState("");
  const [ppMessage, setPpMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [ppLoading, setPpLoading] = useState(false);
  const [ppProgress, setPpProgress] = useState("");

  // Delete account state
  const [deleteExpanded, setDeleteExpanded] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteMessage, setDeleteMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as Node;
    if (
      triggerRef.current &&
      !triggerRef.current.contains(target) &&
      dropdownRef.current &&
      !dropdownRef.current.contains(target)
    ) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside, true);
      return () => document.removeEventListener("mousedown", handleClickOutside, true);
    }
  }, [open, handleClickOutside]);

  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    }
  }, [open]);

  async function handleChangePassword() {
    setPwMessage(null);
    if (pwNew !== pwConfirm) {
      setPwMessage({ type: "error", text: t("account.passwordMismatch") });
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

  async function handleChangePassphrase() {
    setPpMessage(null);
    if (ppNew !== ppConfirm) {
      setPpMessage({ type: "error", text: t("account.passphraseMismatch") });
      return;
    }

    setPpLoading(true);
    try {
      // 1. Get current salt and derive old key
      setPpProgress(t("account.reencrypting"));
      const { encryption_salt: currentSalt } = await getEncryptionSalt();
      let oldKey: CryptoKey;
      try {
        oldKey = await deriveKey(ppCurrent, currentSalt);
      } catch {
        setPpMessage({ type: "error", text: t("account.passphraseError") });
        setPpLoading(false);
        return;
      }

      // 2. Generate new salt and derive new key
      const newSalt = generateSalt();
      const newKey = await deriveKey(ppNew, newSalt);

      // 3. Re-encrypt all data
      const trees = await getTrees();
      for (const tree of trees) {
        // Decrypt and re-encrypt tree
        const treeData = await decryptFromApi(tree.encrypted_data, oldKey);
        const newTreeEncrypted = await encryptForApi(treeData, newKey);

        // Fetch all entities for this tree
        const [persons, relationships, events, lifeEvents] = await Promise.all([
          getPersons(tree.id),
          getRelationships(tree.id),
          getEvents(tree.id),
          getLifeEvents(tree.id),
        ]);

        // Re-encrypt persons
        const personsUpdate = await Promise.all(
          persons.map(async (p) => {
            const data = await decryptFromApi(p.encrypted_data, oldKey);
            const enc = await encryptForApi(data, newKey);
            return { id: p.id, encrypted_data: enc };
          }),
        );

        // Re-encrypt relationships
        const relationshipsUpdate = await Promise.all(
          relationships.map(async (r) => {
            const data = await decryptFromApi(r.encrypted_data, oldKey);
            const enc = await encryptForApi(data, newKey);
            return {
              id: r.id,
              source_person_id: r.source_person_id,
              target_person_id: r.target_person_id,
              encrypted_data: enc,
            };
          }),
        );

        // Re-encrypt events
        const eventsUpdate = await Promise.all(
          events.map(async (e) => {
            const data = await decryptFromApi(e.encrypted_data, oldKey);
            const enc = await encryptForApi(data, newKey);
            return { id: e.id, person_ids: e.person_ids, encrypted_data: enc };
          }),
        );

        // Re-encrypt life events (sent as events in sync since life events
        // are a separate entity type -- we'll update them individually)
        for (const le of lifeEvents) {
          const data = await decryptFromApi(le.encrypted_data, oldKey);
          const enc = await encryptForApi(data, newKey);
          le.encrypted_data = enc;
        }

        // Sync re-encrypted data for this tree using bulk sync
        // First sync persons, relationships, events via syncTree
        await syncTree(tree.id, {
          persons_update: personsUpdate,
          relationships_update: relationshipsUpdate,
          events_update: eventsUpdate,
        });

        // Update tree itself - use the updateTree API
        const { updateTree } = await import("../../lib/api");
        await updateTree(tree.id, { encrypted_data: newTreeEncrypted });

        // Update life events individually
        const { updateLifeEvent } = await import("../../lib/api");
        for (const le of lifeEvents) {
          await updateLifeEvent(tree.id, le.id, {
            person_ids: le.person_ids,
            encrypted_data: le.encrypted_data,
          });
        }
      }

      // 4. Update salt on server
      await updateSalt({ encryption_salt: newSalt });

      // 5. Update key in encryption context
      setKey(newKey);

      setPpMessage({ type: "success", text: t("account.passphraseChanged") });
      setPpCurrent("");
      setPpNew("");
      setPpConfirm("");
      setPpProgress("");
    } catch {
      setPpMessage({ type: "error", text: t("account.passphraseError") });
      setPpProgress("");
    } finally {
      setPpLoading(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteMessage(null);
    setDeleteLoading(true);
    try {
      await deleteAccount({ password: deletePassword });
      logout();
    } catch {
      setDeleteMessage({ type: "error", text: t("account.deleteError") });
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`settings-panel__trigger ${className ?? ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={t("settings.title")}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM5.754 8a2.246 2.246 0 114.492 0 2.246 2.246 0 01-4.492 0z" />
          <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 01-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 01-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 01.52 1.255l-.16.292c-.892 1.64.902 3.434 2.541 2.54l.292-.159a.873.873 0 011.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 011.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 01.52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 01-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 01-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 002.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 001.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 00-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 00-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 00-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291a1.873 1.873 0 00-1.116-2.693l-.318-.094c-.835-.246-.835-1.428 0-1.674l.319-.094a1.873 1.873 0 001.115-2.692l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 002.692-1.116l.094-.318z" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="settings-panel__dropdown"
            style={{ top: pos.top, right: pos.right }}
          >
            <div className="settings-panel__tabs">
              <button
                type="button"
                className={`settings-panel__tab ${tab === "canvas" ? "settings-panel__tab--active" : ""}`}
                onClick={() => setTab("canvas")}
              >
                {t("settings.canvas")}
              </button>
              <button
                type="button"
                className={`settings-panel__tab ${tab === "account" ? "settings-panel__tab--active" : ""}`}
                onClick={() => setTab("account")}
              >
                {t("settings.account")}
              </button>
            </div>

            <div className="settings-panel__content">
              {tab === "canvas" && (
                <>
                  <div className="settings-panel__group">
                    <span className="settings-panel__label">{t("canvas.gridSettings")}</span>
                  </div>

                  <label className="settings-panel__toggle">
                    <input
                      type="checkbox"
                      checked={settings.showGrid}
                      onChange={(e) => onUpdate({ showGrid: e.target.checked })}
                    />
                    <span>{t("canvas.showGrid")}</span>
                  </label>

                  <label className="settings-panel__toggle">
                    <input
                      type="checkbox"
                      checked={settings.snapToGrid}
                      onChange={(e) => onUpdate({ snapToGrid: e.target.checked })}
                    />
                    <span>{t("canvas.snapToGrid")}</span>
                  </label>

                  <div className="settings-panel__divider" />

                  <div className="settings-panel__group">
                    <span className="settings-panel__label">{t("canvas.edgeStyle")}</span>
                    <div className="settings-panel__radios">
                      {EDGE_STYLES.map((style) => (
                        <label key={style} className="settings-panel__radio">
                          <input
                            type="radio"
                            name="edgeStyle"
                            value={style}
                            checked={settings.edgeStyle === style}
                            onChange={() => onUpdate({ edgeStyle: style })}
                          />
                          <span>{t(`canvas.edgeStyle.${style}`)}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="settings-panel__divider" />

                  <div className="settings-panel__group">
                    <span className="settings-panel__label">{t("canvas.other")}</span>
                  </div>

                  <label className="settings-panel__toggle">
                    <input
                      type="checkbox"
                      checked={settings.showMarkers}
                      onChange={(e) => onUpdate({ showMarkers: e.target.checked })}
                    />
                    <span>{t("canvas.showMarkers")}</span>
                  </label>

                  <label className="settings-panel__toggle">
                    <input
                      type="checkbox"
                      checked={settings.showMinimap}
                      onChange={(e) => onUpdate({ showMinimap: e.target.checked })}
                    />
                    <span>{t("canvas.showMinimap")}</span>
                  </label>

                  <div className="settings-panel__divider" />

                  <div className="settings-panel__group">
                    <span className="settings-panel__label">{t("settings.theme")}</span>
                  </div>
                  <div className="settings-panel__theme-row">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="settings-panel__theme-icon"
                    >
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={theme === "dark"}
                      aria-label={t("settings.theme")}
                      className={`settings-panel__theme-switch ${theme === "dark" ? "settings-panel__theme-switch--dark" : ""}`}
                      onClick={toggleTheme}
                    >
                      <span className="settings-panel__theme-knob" />
                    </button>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="settings-panel__theme-icon"
                    >
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  </div>

                  <div className="settings-panel__group">
                    <span className="settings-panel__label">{t("settings.language")}</span>
                    <div className="settings-panel__radios">
                      <label className="settings-panel__radio">
                        <input
                          type="radio"
                          name="language"
                          value="en"
                          checked={i18n.language === "en"}
                          onChange={() => i18n.changeLanguage("en")}
                        />
                        <span>English</span>
                      </label>
                      <label className="settings-panel__radio">
                        <input
                          type="radio"
                          name="language"
                          value="nl"
                          checked={i18n.language === "nl"}
                          onChange={() => i18n.changeLanguage("nl")}
                        />
                        <span>Nederlands</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {tab === "account" && (
                <>
                  {/* Change password */}
                  <div className="settings-panel__section">
                    <h4 className="settings-panel__section-title">{t("account.changePassword")}</h4>
                    {pwMessage && (
                      <div
                        className={`settings-panel__message settings-panel__message--${pwMessage.type}`}
                      >
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
                      onChange={(e) => setPwNew(e.target.value)}
                      autoComplete="new-password"
                    />
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
                      disabled={!pwCurrent || !pwNew || !pwConfirm || pwLoading}
                      onClick={handleChangePassword}
                    >
                      {t("common.save")}
                    </button>
                  </div>

                  <div className="settings-panel__divider" />

                  {/* Change passphrase */}
                  <div className="settings-panel__section">
                    <h4 className="settings-panel__section-title">
                      {t("account.changePassphrase")}
                    </h4>
                    <div className="settings-panel__warning">{t("account.passphraseWarning")}</div>
                    {ppMessage && (
                      <div
                        className={`settings-panel__message settings-panel__message--${ppMessage.type}`}
                      >
                        {ppMessage.text}
                      </div>
                    )}
                    {ppProgress && <div className="settings-panel__progress">{ppProgress}</div>}
                    <input
                      type="password"
                      className="settings-panel__input"
                      placeholder={t("account.currentPassphrase")}
                      value={ppCurrent}
                      onChange={(e) => setPpCurrent(e.target.value)}
                    />
                    <input
                      type="password"
                      className="settings-panel__input"
                      placeholder={t("account.newPassphrase")}
                      value={ppNew}
                      onChange={(e) => setPpNew(e.target.value)}
                    />
                    <input
                      type="password"
                      className="settings-panel__input"
                      placeholder={t("account.confirmNewPassphrase")}
                      value={ppConfirm}
                      onChange={(e) => setPpConfirm(e.target.value)}
                    />
                    <button
                      type="button"
                      className="settings-panel__btn"
                      disabled={!ppCurrent || !ppNew || !ppConfirm || ppLoading}
                      onClick={handleChangePassphrase}
                    >
                      {t("common.save")}
                    </button>
                  </div>

                  <div className="settings-panel__divider" />

                  {/* Delete account */}
                  <div className="settings-panel__section settings-panel__section--danger">
                    <h4 className="settings-panel__section-title">{t("account.deleteAccount")}</h4>
                    {!deleteExpanded ? (
                      <button
                        type="button"
                        className="settings-panel__btn settings-panel__btn--danger"
                        onClick={() => setDeleteExpanded(true)}
                      >
                        {t("account.deleteAccount")}
                      </button>
                    ) : (
                      <div className="settings-panel__delete-confirm">
                        <div className="settings-panel__warning">{t("account.deleteWarning")}</div>
                        {deleteMessage && (
                          <div
                            className={`settings-panel__message settings-panel__message--${deleteMessage.type}`}
                          >
                            {deleteMessage.text}
                          </div>
                        )}
                        <input
                          type="text"
                          className="settings-panel__input"
                          placeholder={t("account.deleteConfirmLabel")}
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                        />
                        <input
                          type="password"
                          className="settings-panel__input"
                          placeholder={t("account.deletePassword")}
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          className="settings-panel__btn settings-panel__btn--danger"
                          disabled={
                            deleteConfirmText !== "DELETE" || !deletePassword || deleteLoading
                          }
                          onClick={handleDeleteAccount}
                        >
                          {t("account.deleteButton")}
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
