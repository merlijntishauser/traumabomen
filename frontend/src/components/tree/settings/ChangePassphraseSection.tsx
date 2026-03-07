import { useState } from "react";
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

export function ChangePassphraseSection() {
  const { t } = useTranslation();
  const { isMigrated, setMasterKey, setPassphraseHash } = useEncryption();

  const [ppCurrent, setPpCurrent] = useState("");
  const [ppNew, setPpNew] = useState("");
  const [ppConfirm, setPpConfirm] = useState("");
  const [ppMessage, setPpMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [ppLoading, setPpLoading] = useState(false);
  const [ppProgress, setPpProgress] = useState("");

  async function handleChangePassphraseMigrated() {
    // Simplified flow: only re-encrypt the key ring (tree keys stay the same)
    setPpProgress(t("account.reencrypting"));
    const { encryption_salt: currentSalt } = await getEncryptionSalt();
    const oldKey = await deriveKey(ppCurrent, currentSalt);

    // Verify old passphrase by attempting to decrypt key ring
    const { encrypted_key_ring } = await getKeyRing();
    const keyRingData = await decryptKeyRing(encrypted_key_ring, oldKey);

    // Derive new key and re-encrypt key ring
    const newSalt = generateSalt();
    const newKey = await deriveKey(ppNew, newSalt);
    const newEncryptedRing = await encryptKeyRing(keyRingData, newKey);

    // Persist salt first: if key-ring update fails, old key-ring + old salt
    // still works. Reverse order would leave new key-ring with old salt,
    // making key derivation impossible.
    await updateSalt({ encryption_salt: newSalt });
    await updateKeyRing(newEncryptedRing);

    // Update context
    const newHash = await hashPassphrase(ppNew);
    setMasterKey(newKey);
    setPassphraseHash(newHash);
  }

  async function handleChangePassphraseLegacy() {
    // Legacy flow: re-encrypt every entity (pre-migration users)
    setPpProgress(t("account.reencrypting"));
    const { encryption_salt: currentSalt } = await getEncryptionSalt();
    const oldKey = await deriveKey(ppCurrent, currentSalt);

    const newSalt = generateSalt();
    const newKey = await deriveKey(ppNew, newSalt);

    const trees = await getTrees();
    for (const tree of trees) {
      const treeData = await decryptFromApi(tree.encrypted_data, oldKey);
      const newTreeEncrypted = await encryptForApi(treeData, newKey);

      const [
        persons,
        relationships,
        events,
        lifeEvents,
        classifications,
        patterns,
        turningPoints,
        journalEntries,
      ] = await Promise.all([
        getPersons(tree.id),
        getRelationships(tree.id),
        getEvents(tree.id),
        getLifeEvents(tree.id),
        getClassifications(tree.id),
        getPatterns(tree.id),
        getTurningPoints(tree.id),
        getJournalEntries(tree.id),
      ]);

      const personsUpdate = await Promise.all(
        persons.map(async (p) => {
          const data = await decryptFromApi(p.encrypted_data, oldKey);
          const enc = await encryptForApi(data, newKey);
          return { id: p.id, encrypted_data: enc };
        }),
      );

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

      const eventsUpdate = await Promise.all(
        events.map(async (e) => {
          const data = await decryptFromApi(e.encrypted_data, oldKey);
          const enc = await encryptForApi(data, newKey);
          return { id: e.id, person_ids: e.person_ids, encrypted_data: enc };
        }),
      );

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
        lifeEventsUpdate,
        classificationsUpdate,
        patternsUpdate,
        turningPointsUpdate,
        journalEntriesUpdate,
      ] = await Promise.all([
        reencryptLinked(lifeEvents),
        reencryptLinked(classifications),
        reencryptLinked(patterns),
        reencryptLinked(turningPoints),
        reencryptSimple(journalEntries),
      ]);

      await syncTree(tree.id, {
        persons_update: personsUpdate,
        relationships_update: relationshipsUpdate,
        events_update: eventsUpdate,
        life_events_update: lifeEventsUpdate,
        classifications_update: classificationsUpdate,
        patterns_update: patternsUpdate,
        turning_points_update: turningPointsUpdate,
        journal_entries_update: journalEntriesUpdate,
      });

      const { updateTree } = await import("../../../lib/api");
      await updateTree(tree.id, { encrypted_data: newTreeEncrypted });
    }

    await updateSalt({ encryption_salt: newSalt });

    const newHash = await hashPassphrase(ppNew);
    setMasterKey(newKey);
    setPassphraseHash(newHash);
  }

  async function handleChangePassphrase() {
    setPpMessage(null);
    if (ppNew !== ppConfirm) {
      setPpMessage({ type: "error", text: t("account.passphraseMismatch") });
      return;
    }

    setPpLoading(true);
    try {
      if (isMigrated) {
        await handleChangePassphraseMigrated();
      } else {
        await handleChangePassphraseLegacy();
      }

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

  return (
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
        data-1p-ignore
      />
      <input
        type="password"
        className="settings-panel__input"
        placeholder={t("account.newPassphrase")}
        value={ppNew}
        onChange={(e) => setPpNew(e.target.value)}
        data-1p-ignore
      />
      <input
        type="password"
        className="settings-panel__input"
        placeholder={t("account.confirmNewPassphrase")}
        value={ppConfirm}
        onChange={(e) => setPpConfirm(e.target.value)}
        data-1p-ignore
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
  );
}
