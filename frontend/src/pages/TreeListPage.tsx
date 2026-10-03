import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, LogOut, Upload } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import { FeedbackModal } from "../components/FeedbackModal";
import { Logomark } from "../components/Logomark";
import { SettingsPanel, type ViewTab } from "../components/tree/SettingsPanel";
import { ThemeLanguageSettings } from "../components/tree/ThemeLanguageSettings";
import { useEncryption } from "../contexts/useEncryption";
import { useImportTree } from "../hooks/useImportTree";
import { useLogout } from "../hooks/useLogout";
import { useTheme } from "../hooks/useTheme";
import {
  createTree,
  deleteTree,
  getIsAdmin,
  getTrees,
  modifyKeyRing,
  updateTree,
} from "../lib/api";
import { uuidToCompact } from "../lib/compactId";
import { createDemoTree } from "../lib/createDemoTree";
import { encryptForApi, generateTreeKey } from "../lib/crypto";
import "../components/tree/TreeCanvas.css";
import { journalPromptText, pickJournalPromptIndex } from "../lib/reflectionPrompts";
import { buildTreeMetaLine, sortByRecentlyTended } from "./treeListMeta";
import "../styles/tree-list.css";

const MAX_DEMO_TREES = 3;

const T_CANCEL = "common.cancel";
const T_DELETE = "common.delete";
const T_NAME_PLACEHOLDER = "tree.namePlaceholder";

interface DecryptedTree {
  id: string;
  name: string;
  is_demo: boolean;
  person_count: number;
  moment_count: number;
  pattern_count: number;
  updated_at: string;
}

/** Front-porch hero: the most recently tended tree plus one open question. */
function ContinueCard({
  tree,
  metaLine,
  prompt,
}: {
  tree: { id: string; name: string; person_count: number };
  metaLine: string;
  prompt: string;
}) {
  const { t } = useTranslation();
  const treePath = `/trees/${uuidToCompact(tree.id)}`;
  // A journal prompt about ancestors means little in a tree with nobody in
  // it yet; point at the canvas instead.
  const started = tree.person_count > 0;
  return (
    <div className="tree-continue">
      <span className="tree-continue__label">{t("tree.continue")}</span>
      <Link className="tree-continue__link" to={treePath}>
        <span className="tree-continue__name">{tree.name}</span>
        <span className="tree-continue__meta">{metaLine}</span>
      </Link>
      <Link className="tree-continue__prompt" to={started ? `${treePath}/journal` : treePath}>
        {started ? prompt : t("tree.startWithYourself")}
      </Link>
    </div>
  );
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
    case "START_EDITING":
      return { ...state, editingId: action.id, editName: action.name };
    case "SET_EDIT_NAME":
      return { ...state, editName: action.name };
    case "CANCEL_EDIT":
      return { ...state, editingId: null };
    case "SET_DELETING":
      return { ...state, deletingId: action.id };
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
  const wasOpenRef = useRef(false);

  // Rename and delete replace the row, so the button that opened them is
  // gone. Move focus into the rename field, and back to the row's link when
  // either closes, so keyboard and screen reader users keep their place.
  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
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
          className="tree-list-item__input"
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          aria-label={t(T_NAME_PLACEHOLDER)}
        />
        <button className="tree-list-item__btn" type="submit" disabled={renamePending}>
          {t("common.save")}
        </button>
        <button className="tree-list-item__btn" type="button" onClick={onCancelEdit}>
          {t(T_CANCEL)}
        </button>
      </form>
    );
  }

  if (isDeleting) {
    return (
      <div className="tree-list-item__confirm">
        <span>{t("tree.confirmDelete")}</span>
        <button
          type="button"
          className="tree-list-item__btn tree-list-item__btn--danger"
          onClick={() => onDelete(tree.id)}
          disabled={deletePending}
        >
          {t(T_DELETE)}
        </button>
        <button type="button" className="tree-list-item__btn" onClick={onCancelDelete}>
          {t(T_CANCEL)}
        </button>
      </div>
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
        <span className="tree-list-item__meta">{buildTreeMetaLine(tree, t, i18n.language)}</span>
      </Link>
      <div className="tree-list-item__actions">
        <button
          type="button"
          className="tree-list-item__btn"
          onClick={() => onStartEditing(tree)}
          aria-label={t("tree.editNamed", { name: tree.name })}
        >
          {t("common.edit")}
        </button>
        <button
          type="button"
          className="tree-list-item__btn tree-list-item__btn--danger"
          onClick={() => onConfirmDelete(tree.id)}
          aria-label={t("tree.deleteNamed", { name: tree.name })}
        >
          {t(T_DELETE)}
        </button>
      </div>
    </div>
  );
}

function TreeListToolbar({
  showCreateActions,
  demoMutationPending,
  onDemoCreate,
  createDisabled,
  onStartCreating,
  importing,
  onImportClick,
  fileInputRef,
  onImportFile,
  viewTab,
  onLogout,
}: {
  /** Hidden while the list is empty: the empty state carries the one way in. */
  showCreateActions: boolean;
  demoMutationPending: boolean;
  onDemoCreate: () => void;
  createDisabled: boolean;
  onStartCreating: () => void;
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
      {showCreateActions && (
        <>
          <button
            type="button"
            className="tree-toolbar__btn"
            onClick={onDemoCreate}
            disabled={demoMutationPending}
          >
            {demoMutationPending ? t("demo.creating") : t("demo.createButton")}
          </button>
          <button
            type="button"
            className="tree-toolbar__btn tree-toolbar__btn--primary"
            data-create-trigger
            onClick={onStartCreating}
            disabled={createDisabled}
          >
            {t("tree.create")}
          </button>
        </>
      )}
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
          Admin
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

/* -- Main component -------------------------------------------------------- */

export default function TreeListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const logout = useLogout();
  const { encrypt, decrypt, masterKey, addTreeKey, removeTreeKey } = useEncryption();
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
  const createInputRef = useRef<HTMLInputElement>(null);
  const createWasOpenRef = useRef(false);

  // The create form replaces the button that opened it. Focus the name field
  // when it opens and return to a create button when it is cancelled.
  useEffect(() => {
    if (state.creating) {
      createInputRef.current?.focus();
    } else if (createWasOpenRef.current) {
      document.querySelector<HTMLButtonElement>("[data-create-trigger]")?.focus();
    }
    createWasOpenRef.current = state.creating;
  }, [state.creating]);
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
            return { id: r.id, name: t("tree.decryptionError"), ...meta };
          }
        }),
      );
      return trees;
    },
  });

  const trees = useMemo(() => sortByRecentlyTended(treesQuery.data ?? []), [treesQuery.data]);
  const isEmpty = treesQuery.data !== undefined && trees.length === 0;
  const demoTreeCount = trees.filter((t) => t.is_demo).length;

  // Front porch: the most recently tended tree and one open question per
  // visit. With a single tree the list already says everything, so the
  // porch only appears once there is a choice to make.
  const mostRecent = trees.length >= 2 ? trees[0] : null;
  const [promptIndex] = useState(pickJournalPromptIndex);

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { key: treeKey, base64: treeKeyBase64 } = await generateTreeKey();
      const encrypted_data = await encryptForApi({ name }, treeKey);
      const response = await createTree({ encrypted_data });
      addTreeKey(response.id, treeKey, treeKeyBase64);
      await modifyKeyRing(masterKey!, (entries) => ({
        ...entries,
        [response.id]: treeKeyBase64,
      }));
      return response;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["trees"] });
      // Close the form so it is not still open when the user comes back.
      dispatch({ type: "STOP_CREATING" });
      navigate(`/trees/${uuidToCompact(response.id)}`);
    },
  });

  const demoMutation = useMutation({
    mutationFn: async () => {
      const { key: treeKey, base64: treeKeyBase64 } = await generateTreeKey();
      const boundEncrypt = (data: unknown) => encryptForApi(data, treeKey);
      const treeId = await createDemoTree(boundEncrypt, i18n.language);
      addTreeKey(treeId, treeKey, treeKeyBase64);
      await modifyKeyRing(masterKey!, (entries) => ({
        ...entries,
        [treeId]: treeKeyBase64,
      }));
      return treeId;
    },
    onSuccess: (treeId) => {
      queryClient.invalidateQueries({ queryKey: ["trees"] });
      navigate(`/trees/${uuidToCompact(treeId)}`);
    },
  });

  // The onboarding gate's "Start with the demo tree" lands here with
  // ?start=demo. Create the demo once and drop the param so a reload or the
  // back button does not create a second one.
  const [searchParams, setSearchParams] = useSearchParams();
  const demoStartedRef = useRef(false);
  const startDemo = searchParams.get("start") === "demo";
  const { mutate: createDemo } = demoMutation;
  useEffect(() => {
    if (!startDemo || !masterKey || demoStartedRef.current) return;
    demoStartedRef.current = true;
    setSearchParams({}, { replace: true });
    createDemo();
  }, [startDemo, masterKey, setSearchParams, createDemo]);

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const encrypted_data = await encrypt({ name }, id);
      return updateTree(id, { encrypted_data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trees"] });
      dispatch({ type: "CANCEL_EDIT" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await deleteTree(id);
      removeTreeKey(id);
      await modifyKeyRing(masterKey!, (entries) => {
        const updated = { ...entries };
        delete updated[id];
        return updated;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trees"] });
      dispatch({ type: "SET_DELETING", id: null });
    },
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
      dispatch({
        type: "SET_IMPORT_ERROR",
        error: err instanceof Error ? err.message : t("tree.importError"),
      });
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

  const createForm = state.creating ? (
    <form className="tree-list-create" onSubmit={handleCreateSubmit}>
      <input
        ref={createInputRef}
        className="tree-list-item__input"
        value={state.newName}
        onChange={(e) => dispatch({ type: "SET_NEW_NAME", name: e.target.value })}
        placeholder={t(T_NAME_PLACEHOLDER)}
        aria-label={t(T_NAME_PLACEHOLDER)}
      />
      <button
        className="tree-list-item__btn"
        type="submit"
        disabled={!state.newName.trim() || createMutation.isPending}
      >
        {t("tree.create")}
      </button>
      <button
        className="tree-list-item__btn"
        type="button"
        onClick={() => dispatch({ type: "STOP_CREATING" })}
      >
        {t(T_CANCEL)}
      </button>
    </form>
  ) : null;

  return (
    <>
      <div className="tree-list-page bg-gradient">
        <a className="skip-link" href="#tree-list-content">
          {t("tree.skipToTrees")}
        </a>
        <TreeListToolbar
          showCreateActions={!isEmpty}
          demoMutationPending={demoMutation.isPending}
          onDemoCreate={handleDemoCreate}
          createDisabled={state.creating || createMutation.isPending}
          onStartCreating={() => dispatch({ type: "START_CREATING" })}
          importing={state.importing}
          onImportClick={() => fileInputRef.current?.click()}
          fileInputRef={fileInputRef}
          onImportFile={handleImportFile}
          viewTab={treeListViewTab}
          onLogout={logout}
        />

        <div className="tree-list-content" id="tree-list-content" tabIndex={-1}>
          {isEmpty ? (
            <FirstTreeWelcome
              onCreateTree={() => dispatch({ type: "START_CREATING" })}
              onDemoCreate={handleDemoCreate}
              onSendMessage={() => dispatch({ type: "SET_SHOW_FEEDBACK", value: true })}
              createDisabled={createMutation.isPending}
              demoPending={demoMutation.isPending}
              createForm={createForm}
            />
          ) : (
            createForm
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

          {mostRecent && (
            <ContinueCard
              tree={mostRecent}
              metaLine={buildTreeMetaLine(mostRecent, t, i18n.language)}
              prompt={journalPromptText(t, promptIndex)}
            />
          )}

          {trees.length > 0 && (
            <ul className="tree-list">
              {trees.map((tree) => (
                <li key={tree.id}>
                  <TreeListItemRow
                    tree={tree}
                    editingId={state.editingId}
                    editName={state.editName}
                    deletingId={state.deletingId}
                    renamePending={renameMutation.isPending}
                    deletePending={deleteMutation.isPending}
                    onEditNameChange={(name) => dispatch({ type: "SET_EDIT_NAME", name })}
                    onRenameSubmit={handleRenameSubmit}
                    onStartEditing={(tree) =>
                      dispatch({ type: "START_EDITING", id: tree.id, name: tree.name })
                    }
                    onCancelEdit={() => dispatch({ type: "CANCEL_EDIT" })}
                    onConfirmDelete={(id) => dispatch({ type: "SET_DELETING", id })}
                    onCancelDelete={() => dispatch({ type: "SET_DELETING", id: null })}
                    onDelete={(id) => deleteMutation.mutate(id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {state.showFeedback && (
        <FeedbackModal onClose={() => dispatch({ type: "SET_SHOW_FEEDBACK", value: false })} />
      )}
    </>
  );
}
