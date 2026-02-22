import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { JournalEntryList } from "../components/journal/JournalEntryList";
import { ThemeLanguageSettings } from "../components/tree/ThemeLanguageSettings";
import { TreeToolbar } from "../components/tree/TreeToolbar";
import { useTreeData } from "../hooks/useTreeData";
import { useTreeId } from "../hooks/useTreeId";
import { useTreeMutations } from "../hooks/useTreeMutations";
import type { JournalEntry } from "../types/domain";
import "../components/tree/TreeCanvas.css";
import "./JournalPage.css";

export default function JournalPage() {
  const treeId = useTreeId();
  const { t } = useTranslation();
  const {
    treeName,
    persons,
    events,
    lifeEvents,
    turningPoints,
    classifications,
    patterns,
    journalEntries,
    isLoading,
    error,
  } = useTreeData(treeId!);
  const mutations = useTreeMutations(treeId!);

  const journalViewTab = useMemo(
    () => ({
      label: t("journal.tab"),
      content: <ThemeLanguageSettings />,
    }),
    [t],
  );

  const sortedEntries = useMemo(
    () =>
      Array.from(journalEntries.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [journalEntries],
  );

  function handleSaveJournalEntry(entryId: string | null, data: JournalEntry) {
    if (entryId) {
      mutations.updateJournalEntry.mutate({ entryId, data });
    } else {
      mutations.createJournalEntry.mutate(data);
    }
  }

  function handleDeleteJournalEntry(entryId: string) {
    mutations.deleteJournalEntry.mutate(entryId);
  }

  if (error) {
    return (
      <div className="tree-workspace">
        <TreeToolbar
          treeId={treeId!}
          treeName={treeName}
          activeView="journal"
          viewTab={journalViewTab}
        />
        <div style={{ padding: 20 }}>{t("tree.decryptionError")}</div>
      </div>
    );
  }

  return (
    <div className="tree-workspace">
      <TreeToolbar
        treeId={treeId!}
        treeName={treeName}
        activeView="journal"
        viewTab={journalViewTab}
      />

      {isLoading ? (
        <div style={{ padding: 20 }}>{t("common.loading")}</div>
      ) : (
        <div className="journal-page">
          <div className="journal-page__content">
            <div className="journal-page__inner">
              <JournalEntryList
                entries={sortedEntries}
                persons={persons}
                events={events}
                lifeEvents={lifeEvents}
                turningPoints={turningPoints}
                classifications={classifications}
                patterns={patterns}
                onSave={handleSaveJournalEntry}
                onDelete={handleDeleteJournalEntry}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
