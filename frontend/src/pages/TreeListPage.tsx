import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, LogOut, Upload, X } from "lucide-react";
import { type FormEvent, useCallback, useMemo, useReducer, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { FeedbackModal } from "../components/FeedbackModal";
import { SettingsPanel, type ViewTab } from "../components/tree/SettingsPanel";
import { ThemeLanguageSettings } from "../components/tree/ThemeLanguageSettings";
import { useEncryption } from "../contexts/useEncryption";
import { useImportTree } from "../hooks/useImportTree";
import { useLogout } from "../hooks/useLogout";
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
import "../styles/tree-list.css";

const WELCOME_DISMISSED_KEY = "traumabomen_welcome_dismissed";
const MAX_DEMO_TREES = 3;

const T_CANCEL = "common.cancel";
const T_DELETE = "common.delete";

interface DecryptedTree {
  id: string;
  name: string;
  is_demo: boolean;
}

/* -- Local state ----------------------------------------------------------- */

interface TreeListLocalState {
  editingId: string | null;
  editName: string;
  deletingId: string | null;
  creating: boolean;
  newName: string;
  welcomeDismissed: boolean;
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
  | { type: "DISMISS_WELCOME" }
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
    case "DISMISS_WELCOME":
      return { ...state, welcomeDismissed: true };
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

interface WelcomeCardProps {
  onDismiss: () => void;
  onSendMessage: () => void;
  onCreateTree: () => void;
  showCreateButton: boolean;
  createDisabled: boolean;
}

function WelcomeCard({
  onDismiss,
  onSendMessage,
  onCreateTree,
  showCreateButton,
  createDisabled,
}: WelcomeCardProps) {
  const { t } = useTranslation();
  return (
    <div className="welcome-card" data-testid="welcome-card">
      <picture>
        <source srcSet="/images/welcome-dark.webp" type="image/webp" />
        <img
          src="/images/welcome-dark.jpg"
          alt=""
          aria-hidden="true"
          className="welcome-card__img welcome-card__img--dark"
        />
      </picture>
      <picture>
        <source srcSet="/images/welcome-light.webp" type="image/webp" />
        <img
          src="/images/welcome-light.jpg"
          alt=""
          aria-hidden="true"
          className="welcome-card__img welcome-card__img--light"
        />
      </picture>
      <button
        type="button"
        className="welcome-card__dismiss"
        onClick={onDismiss}
        aria-label={t("common.close")}
      >
        <X size={16} />
      </button>
      <h2 className="welcome-card__title">{t("welcome.title")}</h2>
      <p className="welcome-card__body">{t("welcome.body")}</p>
      <div className="welcome-card__actions">
        <button
          type="button"
          className="welcome-card__btn welcome-card__btn--accent"
          onClick={onSendMessage}
        >
          {t("welcome.sendMessage")}
        </button>
        {showCreateButton && (
          <button
            type="button"
            className="welcome-card__btn"
            onClick={onCreateTree}
            disabled={createDisabled}
          >
            {t("welcome.createTree")}
          </button>
        )}
      </div>
    </div>
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
  const { t } = useTranslation();

  if (editingId === tree.id) {
    return (
      <form className="tree-list-item__edit" onSubmit={onRenameSubmit}>
        <input
          className="tree-list-item__input"
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
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

  if (deletingId === tree.id) {
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
      <Link className="tree-list-item__link" to={`/trees/${uuidToCompact(tree.id)}`}>
        {tree.name}
        {tree.is_demo && <span className="tree-list-item__demo-badge">{t("demo.badge")}</span>}
      </Link>
      <div className="tree-list-item__actions">
        <button
          type="button"
          className="tree-list-item__btn"
          onClick={() => onStartEditing(tree)}
          title={t("common.edit")}
        >
          {t("common.edit")}
        </button>
        <button
          type="button"
          className="tree-list-item__btn tree-list-item__btn--danger"
          onClick={() => onConfirmDelete(tree.id)}
          title={t(T_DELETE)}
        >
          {t(T_DELETE)}
        </button>
      </div>
    </div>
  );
}

function TreeListToolbar({
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
      <span className="tree-toolbar__title">{t("tree.myTrees")}</span>
      <div className="tree-toolbar__spacer" />
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
        onClick={onStartCreating}
        disabled={createDisabled}
      >
        {t("tree.create")}
      </button>
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
    welcomeDismissed: localStorage.getItem(WELCOME_DISMISSED_KEY) === "true",
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

  const dismissWelcome = useCallback(() => {
    localStorage.setItem(WELCOME_DISMISSED_KEY, "true");
    dispatch({ type: "DISMISS_WELCOME" });
  }, []);

  const treesQuery = useQuery({
    queryKey: ["trees"],
    enabled: masterKey !== null,
    queryFn: async () => {
      const responses = await getTrees();
      const trees: DecryptedTree[] = await Promise.all(
        responses.map(async (r) => {
          try {
            const data = await decrypt<{ name: string }>(r.encrypted_data, r.id);
            return { id: r.id, name: data.name, is_demo: r.is_demo };
          } catch {
            return { id: r.id, name: t("tree.decryptionError"), is_demo: r.is_demo };
          }
        }),
      );
      return trees;
    },
  });

  const demoTreeCount = (treesQuery.data ?? []).filter((t) => t.is_demo).length;

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

  return (
    <>
      <div className="tree-list-page bg-gradient">
        <TreeListToolbar
          demoMutationPending={demoMutation.isPending}
          onDemoCreate={() => {
            if (demoTreeCount >= MAX_DEMO_TREES) {
              dispatch({ type: "SET_SHOW_DEMO_LIMIT", value: true });
            } else {
              dispatch({ type: "SET_SHOW_DEMO_LIMIT", value: false });
              demoMutation.mutate();
            }
          }}
          createDisabled={state.creating || createMutation.isPending}
          onStartCreating={() => dispatch({ type: "START_CREATING" })}
          importing={state.importing}
          onImportClick={() => fileInputRef.current?.click()}
          fileInputRef={fileInputRef}
          onImportFile={handleImportFile}
          viewTab={treeListViewTab}
          onLogout={logout}
        />

        <div className="tree-list-content">
          {!(treesQuery.data && treesQuery.data.length > 0 && state.welcomeDismissed) && (
            <WelcomeCard
              onDismiss={dismissWelcome}
              onSendMessage={() => dispatch({ type: "SET_SHOW_FEEDBACK", value: true })}
              onCreateTree={() => dispatch({ type: "START_CREATING" })}
              showCreateButton={!treesQuery.data || treesQuery.data.length === 0}
              createDisabled={state.creating || createMutation.isPending}
            />
          )}

          {state.creating && (
            <form className="tree-list-create" onSubmit={handleCreateSubmit}>
              <input
                className="tree-list-item__input"
                value={state.newName}
                onChange={(e) => dispatch({ type: "SET_NEW_NAME", name: e.target.value })}
                placeholder={t("tree.namePlaceholder")}
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

          {treesQuery.data && treesQuery.data.length === 0 && (
            <p className="tree-list-empty">{t("tree.empty")}</p>
          )}

          {treesQuery.data && treesQuery.data.length > 0 && (
            <ul className="tree-list">
              {treesQuery.data.map((tree) => (
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
