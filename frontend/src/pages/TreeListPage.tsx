import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, LogOut, Plus, Upload } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { FeedbackModal } from "../components/FeedbackModal";
import { LatestTreeBand } from "../components/LatestTreeBand";
import { Logomark } from "../components/Logomark";
import { TreeRowMenu } from "../components/TreeRowMenu";
import { SettingsPanel, type ViewTab } from "../components/tree/SettingsPanel";
import { ThemeLanguageSettings } from "../components/tree/ThemeLanguageSettings";
import { useEncryption } from "../contexts/useEncryption";
import { useImportTree } from "../hooks/useImportTree";
import { useLogout } from "../hooks/useLogout";
import { useTheme } from "../hooks/useTheme";
import { useTreeListMutations } from "../hooks/useTreeListMutations";
import { getIsAdmin, getTrees } from "../lib/api";
import { uuidToCompact } from "../lib/compactId";
import { importErrorKey } from "../lib/userFacingErrors";
import "../components/tree/TreeCanvas.css";
import { journalPromptText, pickJournalPromptIndex } from "../lib/reflectionPrompts";
import { buildTreeMetaLine, sortByRecentlyTended } from "./treeListMeta";
import "../styles/tree-list.css";

const MAX_DEMO_TREES = 3;

const T_CANCEL = "common.cancel";
const T_NAME_PLACEHOLDER = "tree.namePlaceholder";

interface DecryptedTree {
  id: string;
  name: string;
  is_demo: boolean;
  person_count: number;
  moment_count: number;
  pattern_count: number;
  updated_at: string;
  /** Decryption failed; `name` holds a placeholder, not the tree's name. */
  unreadable?: boolean;
}

/* -- Local state ----------------------------------------------------------- */

interface TreeListLocalState {
  editingId: string | null;
  editName: string;
  deletingId: string | null;
  creating: boolean;
  newName: string;
  showFeedback: boolean;
  showDemoLimit: boolean;
  importing: boolean;
  importError: string | null;
}

type TreeListLocalAction =
  | { type: "START_EDITING"; id: string; name: string }
  | { type: "SET_EDIT_NAME"; name: string }
  | { type: "CANCEL_EDIT" }
  | { type: "SET_DELETING"; id: string | null }
  | { type: "START_CREATING" }
  | { type: "STOP_CREATING" }
  | { type: "SET_NEW_NAME"; name: string }
  | { type: "SET_SHOW_FEEDBACK"; value: boolean }
  | { type: "SET_SHOW_DEMO_LIMIT"; value: boolean }
  | { type: "SET_IMPORTING"; value: boolean }
  | { type: "SET_IMPORT_ERROR"; error: string | null };

function treeListLocalReducer(
  state: TreeListLocalState,
  action: TreeListLocalAction,
): TreeListLocalState {
  switch (action.type) {
    // Rename and delete are mutually exclusive: opening one closes the other.
    case "START_EDITING":
      return { ...state, editingId: action.id, editName: action.name, deletingId: null };
    case "SET_EDIT_NAME":
      return { ...state, editName: action.name };
    case "CANCEL_EDIT":
      return { ...state, editingId: null };
    case "SET_DELETING":
      return {
        ...state,
        deletingId: action.id,
        editingId: action.id ? null : state.editingId,
      };
    case "START_CREATING":
      return { ...state, creating: true, newName: "" };
    case "STOP_CREATING":
      return { ...state, creating: false };
    case "SET_NEW_NAME":
      return { ...state, newName: action.name };
    case "SET_SHOW_FEEDBACK":
      return { ...state, showFeedback: action.value };
    case "SET_SHOW_DEMO_LIMIT":
      return { ...state, showDemoLimit: action.value };
    case "SET_IMPORTING":
      return { ...state, importing: action.value };
    case "SET_IMPORT_ERROR":
      return { ...state, importError: action.error };
  }
}

/* -- Sub-components -------------------------------------------------------- */

interface FirstTreeWelcomeProps {
  onCreateTree: () => void;
  onDemoCreate: () => void;
  onSendMessage: () => void;
  createDisabled: boolean;
  demoPending: boolean;
  /** The create form, rendered in place of the actions once the user starts. */
  createForm: React.ReactNode | null;
}

/**
 * The empty state for someone with no trees yet: what a tree is, one clear
 * way to begin, a quiet way to look around first, and the beta note last.
 */
function FirstTreeWelcome({
  onCreateTree,
  onDemoCreate,
  onSendMessage,
  createDisabled,
  demoPending,
  createForm,
}: FirstTreeWelcomeProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const image = theme === "light" ? "welcome-light" : "welcome-dark";
  return (
    <section
      className="first-tree"
      data-testid="first-tree-welcome"
      aria-labelledby="first-tree-title"
    >
      <picture>
        <source srcSet={`/images/${image}.webp`} type="image/webp" />
        <img
          src={`/images/${image}.jpg`}
          alt=""
          aria-hidden="true"
          className={`first-tree__img first-tree__img--${theme}`}
        />
      </picture>
      <div className="first-tree__content">
        <h2 id="first-tree-title" className="first-tree__title">
          {t("firstTree.title")}
        </h2>
        <p className="first-tree__body">{t("firstTree.body")}</p>
        {createForm ?? (
          <div className="first-tree__actions">
            <button
              type="button"
              className="btn btn--primary"
              data-create-trigger
              onClick={onCreateTree}
              disabled={createDisabled}
            >
              {t("welcome.createTree")}
            </button>
            <button
              type="button"
              className="first-tree__quiet"
              onClick={onDemoCreate}
              disabled={demoPending}
            >
              {demoPending ? t("demo.creating") : t("firstTree.exploreDemo")}
            </button>
          </div>
        )}
      </div>
      <p className="first-tree__beta">
        {t("firstTree.beta")}{" "}
        <button type="button" className="first-tree__beta-link" onClick={onSendMessage}>
          {t("welcome.sendMessage")}
        </button>
      </p>
    </section>
  );
}

interface TreeListItemProps {
  tree: DecryptedTree;
  editingId: string | null;
  editName: string;
  deletingId: string | null;
  renamePending: boolean;
  deletePending: boolean;
  onEditNameChange: (name: string) => void;
  onRenameSubmit: (e: FormEvent) => void;
  onStartEditing: (tree: DecryptedTree) => void;
  onCancelEdit: () => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  onDelete: (id: string) => void;
}

function TreeListItemRow({
  tree,
  editingId,
  editName,
  deletingId,
  renamePending,
  deletePending,
  onEditNameChange,
  onRenameSubmit,
  onStartEditing,
  onCancelEdit,
  onConfirmDelete,
  onCancelDelete,
  onDelete,
}: TreeListItemProps) {
  const { t, i18n } = useTranslation();
  const isEditing = editingId === tree.id;
  const isDeleting = deletingId === tree.id;
  const linkRef = useRef<HTMLAnchorElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  // Rename and delete replace the row, so the button that opened them is
  // gone. Move focus into the rename field, and back to the row's link when
  // either closes, so keyboard and screen reader users keep their place.
  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    } else if (isDeleting) {
      // Start on the safe choice.
      cancelDeleteRef.current?.focus();
    } else if (!isDeleting && wasOpenRef.current) {
      linkRef.current?.focus();
    }
    wasOpenRef.current = isEditing || isDeleting;
  }, [isEditing, isDeleting]);

  if (isEditing) {
    return (
      <form className="tree-list-item__edit" onSubmit={onRenameSubmit}>
        <input
          ref={editInputRef}
          type="text"
          autoComplete="off"
          className="tree-list-item__input"
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          aria-label={t(T_NAME_PLACEHOLDER)}
        />
        <button className="btn btn--primary" type="submit" disabled={renamePending}>
          {t("common.save")}
        </button>
        <button className="btn" type="button" onClick={onCancelEdit}>
          {t(T_CANCEL)}
        </button>
      </form>
    );
  }

  if (isDeleting) {
    return (
      <section className="tree-list-item__confirm" aria-labelledby={`delete-${tree.id}`}>
        <p id={`delete-${tree.id}`} className="tree-list-item__confirm-title">
          {t("tree.confirmDeleteNamed", { name: tree.name })}
        </p>
        <p className="tree-list-item__confirm-body">{t("tree.confirmDeleteBody")}</p>
        <div className="tree-list-item__confirm-actions">
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => onDelete(tree.id)}
            disabled={deletePending}
          >
            {t("tree.deleteTree")}
          </button>
          <button ref={cancelDeleteRef} type="button" className="btn" onClick={onCancelDelete}>
            {t(T_CANCEL)}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="tree-list-item">
      <Logomark size={24} className="tree-list-item__mark" />
      <Link ref={linkRef} className="tree-list-item__link" to={`/trees/${uuidToCompact(tree.id)}`}>
        <span className="tree-list-item__name">
          {tree.name}
          {tree.is_demo && <span className="tree-list-item__demo-badge">{t("demo.badge")}</span>}
        </span>
        <span className="tree-list-item__meta">
          {tree.unreadable ? t("tree.unreadableHint") : buildTreeMetaLine(tree, t, i18n.language)}
        </span>
      </Link>
      <TreeRowMenu
        treeName={tree.name}
        onRename={tree.unreadable ? undefined : () => onStartEditing(tree)}
        onDelete={() => onConfirmDelete(tree.id)}
      />
    </div>
  );
}

function TreeListToolbar({
  importing,
  onImportClick,
  fileInputRef,
  onImportFile,
  viewTab,
  onLogout,
}: {
  importing: boolean;
  onImportClick: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  viewTab: ViewTab;
  onLogout: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="tree-toolbar">
      <h1 className="tree-toolbar__title">{t("tree.myTrees")}</h1>
      <div className="tree-toolbar__spacer" />
      <button
        type="button"
        className="tree-toolbar__icon-btn"
        onClick={onImportClick}
        disabled={importing}
        aria-label={t("tree.import")}
      >
        <Upload size={14} />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={onImportFile}
        aria-label={t("tree.import")}
      />
      <SettingsPanel viewTab={viewTab} className="tree-toolbar__icon-btn" />
      {getIsAdmin() && (
        <Link to="/admin" className="tree-toolbar__btn">
          {t("nav.admin")}
        </Link>
      )}
      <button
        type="button"
        className="tree-toolbar__icon-btn"
        onClick={onLogout}
        aria-label={t("nav.logout")}
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}

/** Labelled create form. Replaces the button that opened it, so it takes
 *  focus on open and hands it back to a create button when it closes. */
function CreateTreeForm({
  name,
  pending,
  onNameChange,
  onSubmit,
  onCancel,
}: {
  name: string;
  pending: boolean;
  onNameChange: (name: string) => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      document.querySelector<HTMLButtonElement>("[data-create-trigger]")?.focus();
    };
  }, []);

  return (
    <form className="tree-list-create" onSubmit={onSubmit}>
      <label htmlFor="new-tree-name">{t("tree.nameLabel")}</label>
      <input
        id="new-tree-name"
        ref={inputRef}
        type="text"
        autoComplete="off"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={t("tree.nameExample")}
        aria-describedby="new-tree-hint"
      />
      <p id="new-tree-hint" className="tree-list-create__hint">
        {t("tree.nameHint")}
      </p>
      <div className="tree-list-create__actions">
        <button className="btn btn--primary" type="submit" disabled={!name.trim() || pending}>
          {t("tree.create")}
        </button>
        <button className="btn" type="button" onClick={onCancel}>
          {t(T_CANCEL)}
        </button>
      </div>
    </form>
  );
}

/* -- Main component -------------------------------------------------------- */

export default function TreeListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const logout = useLogout();
  const { decrypt, masterKey } = useEncryption();
  const queryClient = useQueryClient();

  const [state, dispatch] = useReducer(treeListLocalReducer, {
    editingId: null,
    editName: "",
    deletingId: null,
    creating: false,
    newName: "",
    showFeedback: false,
    showDemoLimit: false,
    importing: false,
    importError: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { importTree } = useImportTree();

  const treeListViewTab = useMemo(
    () => ({
      label: t("tree.myTrees"),
      content: <ThemeLanguageSettings />,
    }),
    [t],
  );

  const treesQuery = useQuery({
    queryKey: ["trees"],
    enabled: masterKey !== null,
    queryFn: async () => {
      const responses = await getTrees();
      const trees: DecryptedTree[] = await Promise.all(
        responses.map(async (r) => {
          const meta = {
            is_demo: r.is_demo,
            person_count: r.person_count,
            moment_count: r.moment_count,
            pattern_count: r.pattern_count,
            updated_at: r.updated_at,
          };
          try {
            const data = await decrypt<{ name: string }>(r.encrypted_data, r.id);
            return { id: r.id, name: data.name, ...meta };
          } catch {
            return { id: r.id, name: t("tree.unreadableName"), unreadable: true, ...meta };
          }
        }),
      );
      return trees;
    },
  });

  const trees = useMemo(() => sortByRecentlyTended(treesQuery.data ?? []), [treesQuery.data]);
  const isEmpty = treesQuery.data !== undefined && trees.length === 0;
  const demoTreeCount = trees.filter((t) => t.is_demo).length;

  // The threshold: the most recently tended readable tree, drawn large. The
  // rest sit below it as rows.
  const latest = trees.find((tree) => !tree.unreadable) ?? null;
  const otherTrees = latest ? trees.filter((tree) => tree.id !== latest.id) : trees;
  const [promptIndex] = useState(pickJournalPromptIndex);

  const { createMutation, demoMutation, renameMutation, deleteMutation } = useTreeListMutations({
    onCreated: () => dispatch({ type: "STOP_CREATING" }),
    onRenamed: () => dispatch({ type: "CANCEL_EDIT" }),
    onDeleted: () => dispatch({ type: "SET_DELETING", id: null }),
  });

  function handleRenameSubmit(e: FormEvent) {
    e.preventDefault();
    if (!state.editingId || !state.editName.trim()) return;
    renameMutation.mutate({ id: state.editingId, name: state.editName.trim() });
  }

  function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!state.newName.trim()) return;
    createMutation.mutate(state.newName.trim());
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so re-selecting the same file triggers onChange
    e.target.value = "";
    dispatch({ type: "SET_IMPORTING", value: true });
    dispatch({ type: "SET_IMPORT_ERROR", error: null });
    try {
      const treeId = await importTree(file);
      queryClient.invalidateQueries({ queryKey: ["trees"] });
      navigate(`/trees/${uuidToCompact(treeId)}`);
    } catch (err) {
      dispatch({ type: "SET_IMPORT_ERROR", error: t(importErrorKey(err)) });
    } finally {
      dispatch({ type: "SET_IMPORTING", value: false });
    }
  }

  function handleDemoCreate() {
    if (demoTreeCount >= MAX_DEMO_TREES) {
      dispatch({ type: "SET_SHOW_DEMO_LIMIT", value: true });
    } else {
      dispatch({ type: "SET_SHOW_DEMO_LIMIT", value: false });
      demoMutation.mutate();
    }
  }

  function rowProps(tree: DecryptedTree) {
    return {
      tree,
      editingId: state.editingId,
      editName: state.editName,
      deletingId: state.deletingId,
      renamePending: renameMutation.isPending,
      deletePending: deleteMutation.isPending,
      onEditNameChange: (name: string) => dispatch({ type: "SET_EDIT_NAME", name }),
      onRenameSubmit: handleRenameSubmit,
      onStartEditing: (row: { id: string; name: string }) =>
        dispatch({ type: "START_EDITING", id: row.id, name: row.name }),
      onCancelEdit: () => dispatch({ type: "CANCEL_EDIT" }),
      onConfirmDelete: (id: string) => dispatch({ type: "SET_DELETING", id }),
      onCancelDelete: () => dispatch({ type: "SET_DELETING", id: null }),
      onDelete: (id: string) => deleteMutation.mutate(id),
    };
  }

  const createForm = state.creating ? (
    <CreateTreeForm
      name={state.newName}
      pending={createMutation.isPending}
      onNameChange={(name) => dispatch({ type: "SET_NEW_NAME", name })}
      onSubmit={handleCreateSubmit}
      onCancel={() => dispatch({ type: "STOP_CREATING" })}
    />
  ) : null;

  return (
    <>
      <div className="tree-list-page bg-gradient">
        <a className="skip-link" href="#tree-list-content">
          {t("tree.skipToTrees")}
        </a>
        <TreeListToolbar
          importing={state.importing}
          onImportClick={() => fileInputRef.current?.click()}
          fileInputRef={fileInputRef}
          onImportFile={handleImportFile}
          viewTab={treeListViewTab}
          onLogout={logout}
        />

        <div className="tree-list-content" id="tree-list-content" tabIndex={-1}>
          {isEmpty && (
            <FirstTreeWelcome
              onCreateTree={() => dispatch({ type: "START_CREATING" })}
              onDemoCreate={handleDemoCreate}
              onSendMessage={() => dispatch({ type: "SET_SHOW_FEEDBACK", value: true })}
              createDisabled={createMutation.isPending}
              demoPending={demoMutation.isPending}
              createForm={createForm}
            />
          )}

          {state.showDemoLimit && demoTreeCount >= MAX_DEMO_TREES && (
            <div className="tree-list-limit">
              <AlertTriangle size={16} />
              <span>{t("demo.limitReachedHint")}</span>
            </div>
          )}

          {state.importing && <p className="tree-list-loading">{t("tree.importing")}</p>}

          {state.importError && (
            <div className="tree-list-limit">
              <AlertTriangle size={16} />
              <span>{state.importError}</span>
            </div>
          )}

          {treesQuery.isLoading && <p className="tree-list-loading">{t("common.loading")}</p>}

          {latest && (
            <LatestTreeBand
              tree={latest}
              metaLine={buildTreeMetaLine(latest, t, i18n.language)}
              prompt={journalPromptText(t, promptIndex)}
              onRename={() => dispatch({ type: "START_EDITING", id: latest.id, name: latest.name })}
              onDelete={() => dispatch({ type: "SET_DELETING", id: latest.id })}
            >
              {(state.editingId === latest.id || state.deletingId === latest.id) && (
                <TreeListItemRow {...rowProps(latest)} />
              )}
            </LatestTreeBand>
          )}

          {otherTrees.length > 0 && (
            <section className="tree-list-section" aria-labelledby="other-trees-title">
              <h2 id="other-trees-title" className="tree-list-section__title">
                {/* With no readable tree in the band, these are not "other" trees. */}
                {t(latest ? "treeList.otherTrees" : "treeList.yourTrees")}
              </h2>
              <ul className="tree-list">
                {otherTrees.map((tree) => (
                  <li key={tree.id}>
                    <TreeListItemRow {...rowProps(tree)} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!isEmpty && treesQuery.data !== undefined && (
            <div className="tree-list-start">
              {createForm ?? (
                <div className="tree-list-start__actions">
                  <button
                    type="button"
                    className="btn"
                    data-create-trigger
                    onClick={() => dispatch({ type: "START_CREATING" })}
                    disabled={createMutation.isPending}
                  >
                    <Plus size={15} aria-hidden="true" />
                    {t("treeList.startNew")}
                  </button>
                  <button
                    type="button"
                    className="tree-list-start__quiet"
                    onClick={handleDemoCreate}
                    disabled={demoMutation.isPending}
                  >
                    {demoMutation.isPending ? t("demo.creating") : t("treeList.exploreDemo")}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {state.showFeedback && (
        <FeedbackModal onClose={() => dispatch({ type: "SET_SHOW_FEEDBACK", value: false })} />
      )}
    </>
  );
}
