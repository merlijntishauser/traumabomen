import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { JournalEntryForm } from "../components/journal/JournalEntryForm";
import type { JournalEntityMaps } from "../components/journal/JournalLinkedChips";
import { JournalMargin } from "../components/journal/JournalMargin";
import { JournalReader } from "../components/journal/JournalReader";
import { ContourDecoration } from "../components/tree/ContourDecoration";
import { ThemeLanguageSettings } from "../components/tree/ThemeLanguageSettings";
import { TreeToolbar } from "../components/tree/TreeToolbar";
import type { DecryptedJournalEntry } from "../hooks/useTreeData";
import { useTreeData } from "../hooks/useTreeData";
import { useTreeId } from "../hooks/useTreeId";
import { useTreeMutations } from "../hooks/useTreeMutations";
import type { JournalEntry } from "../types/domain";
import "../components/tree/TreeCanvas.css";
import "./JournalPage.css";
import { treeLoadErrorKey } from "../lib/userFacingErrors";

/** What the writing column shows: a fresh page, an earlier entry, or that entry being edited. */
type DeskView = { kind: "new" } | { kind: "read"; id: string } | { kind: "edit"; id: string };

interface DeskColumnProps {
  view: DeskView;
  entry: DecryptedJournalEntry | null;
  entities: JournalEntityMaps;
  newPageKey: number;
  onCreate: (data: JournalEntry) => void;
  onUpdate: (entryId: string, data: JournalEntry) => void;
  onDelete: (entryId: string) => void;
  onView: (view: DeskView) => void;
  onClearNew: () => void;
}

/** The writing column: one question and a fresh page, or an earlier entry to reread and edit. */
function DeskColumn({
  view,
  entry,
  entities,
  newPageKey,
  onCreate,
  onUpdate,
  onDelete,
  onView,
  onClearNew,
}: DeskColumnProps) {
  const { t } = useTranslation();
  if (view.kind === "read" && entry) {
    return (
      <JournalReader
        entry={entry}
        entities={entities}
        onEdit={() => onView({ kind: "edit", id: entry.id })}
        onNewEntry={() => onView({ kind: "new" })}
      />
    );
  }
  if (view.kind === "edit" && entry) {
    return (
      <JournalEntryForm
        key={entry.id}
        variant="sheet"
        entry={entry}
        {...entities}
        onSave={(data) => {
          onUpdate(entry.id, data);
          onView({ kind: "read", id: entry.id });
        }}
        onDelete={() => {
          onDelete(entry.id);
          onView({ kind: "new" });
        }}
        onCancel={() => onView({ kind: "read", id: entry.id })}
      />
    );
  }
  return (
    <>
      <h2 className="sr-only">{t("journal.newEntry")}</h2>
      <JournalEntryForm
        key={newPageKey}
        variant="sheet"
        entry={null}
        {...entities}
        onSave={(data) => {
          onCreate(data);
          onClearNew();
        }}
        onCancel={onClearNew}
      />
    </>
  );
}

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
  const [view, setView] = useState<DeskView>({ kind: "new" });
  // A fresh page after saving or clearing: remounting the form empties it.
  const [newPageKey, setNewPageKey] = useState(0);

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

  const entities = useMemo<JournalEntityMaps>(
    () => ({ persons, events, lifeEvents, turningPoints, classifications, patterns }),
    [persons, events, lifeEvents, turningPoints, classifications, patterns],
  );
  const selectedEntry = view.kind === "new" ? null : (journalEntries.get(view.id) ?? null);

  if (error) {
    return (
      <div className="tree-workspace">
        <TreeToolbar
          treeId={treeId!}
          treeName={treeName}
          activeView="journal"
          viewTab={journalViewTab}
        />
        <div style={{ padding: 20 }}>{t(treeLoadErrorKey(error))}</div>
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
        <div className="journal-page bg-gradient">
          <ContourDecoration />
          <div className="journal-page__content">
            <div className="journal-desk">
              <section className="journal-desk__column" aria-label={t("journal.deskLabel")}>
                <DeskColumn
                  view={view}
                  entry={selectedEntry}
                  entities={entities}
                  newPageKey={newPageKey}
                  onCreate={(data) => mutations.createJournalEntry.mutate(data)}
                  onUpdate={(entryId, data) =>
                    mutations.updateJournalEntry.mutate({ entryId, data })
                  }
                  onDelete={(entryId) => mutations.deleteJournalEntry.mutate(entryId)}
                  onView={setView}
                  onClearNew={() => setNewPageKey((k) => k + 1)}
                />
              </section>
              <JournalMargin
                entries={sortedEntries}
                entities={entities}
                selectedId={view.kind === "new" ? null : view.id}
                onSelect={(id) => setView({ kind: "read", id })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
