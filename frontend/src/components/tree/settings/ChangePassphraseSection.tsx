import { useReducer } from "react";
import { useTranslation } from "react-i18next";
import { useEncryption } from "../../../contexts/useEncryption";
import {
  getClassifications,
  getEncryptionSalt,
  getEvents,
  getJournalEntries,
  getKeyRing,
  getLifeEvents,
  getPatterns,
  getPersons,
  getRelationships,
  getTrees,
  getTurningPoints,
  syncTree,
  updateKeyRing,
  updateSalt,
  updateTree,
} from "../../../lib/api";
import {
  decryptFromApi,
  decryptKeyRing,
  deriveKey,
  encryptForApi,
  encryptKeyRing,
  generateSalt,
  hashPassphrase,
} from "../../../lib/crypto";
import { PassphraseInput } from "../../PassphraseInput";

async function reencryptTree(
  tree: { id: string; encrypted_data: string },
  oldKey: CryptoKey,
  newKey: CryptoKey,
) {
  const reencryptLinked = async (
    items: { id: string; person_ids: string[]; encrypted_data: string }[],
  ) =>
    Promise.all(
      items.map(async (item) => {
        const data = await decryptFromApi(item.encrypted_data, oldKey);
        const enc = await encryptForApi(data, newKey);
        return { id: item.id, person_ids: item.person_ids, encrypted_data: enc };
      }),
    );

  const reencryptSimple = async (items: { id: string; encrypted_data: string }[]) =>
    Promise.all(
      items.map(async (item) => {
        const data = await decryptFromApi(item.encrypted_data, oldKey);
        const enc = await encryptForApi(data, newKey);
        return { id: item.id, encrypted_data: enc };
      }),
    );

  const [
    treeData,
    persons,
    relationships,
    events,
    lifeEvents,
    classifications,
    patterns,
    turningPoints,
    journalEntries,
  ] = await Promise.all([
    decryptFromApi(tree.encrypted_data, oldKey),
    getPersons(tree.id),
    getRelationships(tree.id),
    getEvents(tree.id),
    getLifeEvents(tree.id),
    getClassifications(tree.id),
    getPatterns(tree.id),
    getTurningPoints(tree.id),
    getJournalEntries(tree.id),
  ]);

  return Promise.all([
    encryptForApi(treeData, newKey),
    reencryptSimple(persons),
    Promise.all(
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
    ),
    reencryptLinked(events),
    reencryptLinked(lifeEvents),
    reencryptLinked(classifications),
    reencryptLinked(patterns),
    reencryptLinked(turningPoints),
    reencryptSimple(journalEntries),
  ]).then(
    ([
      newTreeEncrypted,
      personsUpdate,
      relationshipsUpdate,
      eventsUpdate,
      lifeEventsUpdate,
      classificationsUpdate,
      patternsUpdate,
      turningPointsUpdate,
      journalEntriesUpdate,
    ]) =>
      Promise.all([
        syncTree(tree.id, {
          persons_update: personsUpdate,
          relationships_update: relationshipsUpdate,
          events_update: eventsUpdate,
          life_events_update: lifeEventsUpdate,
          classifications_update: classificationsUpdate,
          patterns_update: patternsUpdate,
          turning_points_update: turningPointsUpdate,
          journal_entries_update: journalEntriesUpdate,
        }),
        updateTree(tree.id, { encrypted_data: newTreeEncrypted }),
      ]),
  );
}

interface PassphraseState {
  current: string;
  newPp: string;
  confirm: string;
  message: { type: "success" | "error"; text: string } | null;
  loading: boolean;
  progress: string;
}

type PassphraseAction =
  | { type: "SET_FIELD"; field: "current" | "newPp" | "confirm"; value: string }
  | { type: "SET_MESSAGE"; message: PassphraseState["message"] }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_PROGRESS"; progress: string }
  | { type: "RESET" };

const passphraseInitialState: PassphraseState = {
  current: "",
  newPp: "",
  confirm: "",
  message: null,
  loading: false,
  progress: "",
};

function passphraseReducer(state: PassphraseState, action: PassphraseAction): PassphraseState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_MESSAGE":
      return { ...state, message: action.message };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_PROGRESS":
      return { ...state, progress: action.progress };
    case "RESET":
      return { ...state, current: "", newPp: "", confirm: "", progress: "" };
  }
}

export function ChangePassphraseSection() {
  const { t } = useTranslation();
  const { isMigrated, setMasterKey, setPassphraseHash } = useEncryption();
  const [state, dispatch] = useReducer(passphraseReducer, passphraseInitialState);

  async function handleChangePassphraseMigrated() {
    // Simplified flow: only re-encrypt the key ring (tree keys stay the same)
    dispatch({ type: "SET_PROGRESS", progress: t("account.reencrypting") });
    const { encryption_salt: currentSalt } = await getEncryptionSalt();
    const oldKey = await deriveKey(state.current, currentSalt);

    // Verify old passphrase by attempting to decrypt key ring
    const { encrypted_key_ring } = await getKeyRing();
    const keyRingData = await decryptKeyRing(encrypted_key_ring, oldKey);

    // Derive new key and re-encrypt key ring
    const newSalt = generateSalt();
    const newKey = await deriveKey(state.newPp, newSalt);
    const newEncryptedRing = await encryptKeyRing(keyRingData, newKey);

    // Persist salt first: if key-ring update fails, old key-ring + old salt
    // still works. Reverse order would leave new key-ring with old salt,
    // making key derivation impossible.
    await updateSalt({ encryption_salt: newSalt });
    await updateKeyRing(newEncryptedRing);

    // Update context
    const newHash = await hashPassphrase(state.newPp);
    setMasterKey(newKey);
    setPassphraseHash(newHash);
  }

  async function handleChangePassphraseLegacy() {
    // Legacy flow: re-encrypt every entity (pre-migration users)
    dispatch({ type: "SET_PROGRESS", progress: t("account.reencrypting") });
    const [{ encryption_salt: currentSalt }, trees] = await Promise.all([
      getEncryptionSalt(),
      getTrees(),
    ]);
    const newSalt = generateSalt();
    const [oldKey, newKey] = await Promise.all([
      deriveKey(state.current, currentSalt),
      deriveKey(state.newPp, newSalt),
    ]);
    for (const tree of trees) {
      await reencryptTree(tree, oldKey, newKey);
    }

    await Promise.all([
      updateSalt({ encryption_salt: newSalt }),
      hashPassphrase(state.newPp).then((newHash) => {
        setMasterKey(newKey);
        setPassphraseHash(newHash);
      }),
    ]);
  }

  async function handleChangePassphrase() {
    dispatch({ type: "SET_MESSAGE", message: null });
    if (state.newPp !== state.confirm) {
      dispatch({
        type: "SET_MESSAGE",
        message: { type: "error", text: t("account.passphraseMismatch") },
      });
      return;
    }

    dispatch({ type: "SET_LOADING", loading: true });
    try {
      if (isMigrated) {
        await handleChangePassphraseMigrated();
      } else {
        await handleChangePassphraseLegacy();
      }

      dispatch({
        type: "SET_MESSAGE",
        message: { type: "success", text: t("account.passphraseChanged") },
      });
      dispatch({ type: "RESET" });
    } catch {
      dispatch({
        type: "SET_MESSAGE",
        message: { type: "error", text: t("account.passphraseError") },
      });
      dispatch({ type: "SET_PROGRESS", progress: "" });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }

  return (
    <div className="settings-panel__section">
      <h4 className="settings-panel__section-title">{t("account.changePassphrase")}</h4>
      <div className="settings-panel__warning">{t("account.passphraseWarning")}</div>
      {state.message && (
        <div className={`settings-panel__message settings-panel__message--${state.message.type}`}>
          {state.message.text}
        </div>
      )}
      {state.progress && <div className="settings-panel__progress">{state.progress}</div>}
      <PassphraseInput
        className="settings-panel__input"
        placeholder={t("account.currentPassphrase")}
        value={state.current}
        onChange={(e) => dispatch({ type: "SET_FIELD", field: "current", value: e.target.value })}
      />
      <PassphraseInput
        className="settings-panel__input"
        placeholder={t("account.newPassphrase")}
        value={state.newPp}
        onChange={(e) => dispatch({ type: "SET_FIELD", field: "newPp", value: e.target.value })}
      />
      <PassphraseInput
        className="settings-panel__input"
        placeholder={t("account.confirmNewPassphrase")}
        value={state.confirm}
        onChange={(e) => dispatch({ type: "SET_FIELD", field: "confirm", value: e.target.value })}
      />
      <button
        type="button"
        className="settings-panel__btn"
        disabled={!state.current || !state.newPp || !state.confirm || state.loading}
        onClick={handleChangePassphrase}
      >
        {t("common.save")}
      </button>
    </div>
  );
}
