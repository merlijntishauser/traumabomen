import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, LogOut, Upload, X } from "lucide-react";
import { type FormEvent, useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { FeedbackModal } from "../components/FeedbackModal";
import { SettingsPanel } from "../components/tree/SettingsPanel";
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

export default function TreeListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const logout = useLogout();
  const { encrypt, decrypt, masterKey, addTreeKey, removeTreeKey } = useEncryption();
  const queryClient = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [welcomeDismissed, setWelcomeDismissed] = useState(
    () => localStorage.getItem(WELCOME_DISMISSED_KEY) === "true",
  );
  const [showFeedback, setShowFeedback] = useState(false);
  const [showDemoLimit, setShowDemoLimit] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
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
    setWelcomeDismissed(true);
  }, []);

  const treesQuery = useQuery({
    queryKey: ["trees"],
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

  const demoTreeCount = useMemo(
    () => (treesQuery.data ?? []).filter((t) => t.is_demo).length,
    [treesQuery.data],
  );

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
      setEditingId(null);
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
      setDeletingId(null);
    },
  });

  function startEditing(tree: DecryptedTree) {
    setEditingId(tree.id);
    setEditName(tree.name);
  }

  function handleRenameSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !editName.trim()) return;
    renameMutation.mutate({ id: editingId, name: editName.trim() });
  }

  function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate(newName.trim());
  }

  function startCreating() {
    setCreating(true);
    setNewName("");
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so re-selecting the same file triggers onChange
    e.target.value = "";
    setImporting(true);
    setImportError(null);
    try {
      const treeId = await importTree(file);
      queryClient.invalidateQueries({ queryKey: ["trees"] });
      navigate(`/trees/${uuidToCompact(treeId)}`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t("tree.importError"));
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <div className="tree-list-page bg-gradient">
        <div className="tree-toolbar">
          <span className="tree-toolbar__title">{t("tree.myTrees")}</span>
          <div className="tree-toolbar__spacer" />
          <button
            type="button"
            className="tree-toolbar__btn"
            onClick={() => {
              if (demoTreeCount >= MAX_DEMO_TREES) {
                setShowDemoLimit(true);
              } else {
                setShowDemoLimit(false);
                demoMutation.mutate();
              }
            }}
            disabled={demoMutation.isPending}
          >
            {demoMutation.isPending ? t("demo.creating") : t("demo.createButton")}
          </button>
          <button
            type="button"
            className="tree-toolbar__btn tree-toolbar__btn--primary"
            onClick={startCreating}
            disabled={creating || createMutation.isPending}
          >
            {t("tree.create")}
          </button>
          <button
            type="button"
            className="tree-toolbar__icon-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            aria-label={t("tree.import")}
            title={t("tree.import")}
          >
            <Upload size={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />
          <SettingsPanel viewTab={treeListViewTab} className="tree-toolbar__icon-btn" />
          {getIsAdmin() && (
            <Link to="/admin" className="tree-toolbar__btn">
              Admin
            </Link>
          )}
          <button
            type="button"
            className="tree-toolbar__icon-btn"
            onClick={logout}
            aria-label={t("nav.logout")}
          >
            <LogOut size={14} />
          </button>
        </div>

        <div className="tree-list-content">
          {!(treesQuery.data && treesQuery.data.length > 0 && welcomeDismissed) && (
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
              <picture>
                <source srcSet="/images/welcome-watercolor.webp" type="image/webp" />
                <img
                  src="/images/welcome-watercolor.jpg"
                  alt=""
                  aria-hidden="true"
                  className="welcome-card__img welcome-card__img--watercolor"
                  loading="lazy"
                />
              </picture>
              <button
                type="button"
                className="welcome-card__dismiss"
                onClick={dismissWelcome}
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
                  onClick={() => setShowFeedback(true)}
                >
                  {t("welcome.sendMessage")}
                </button>
                {(!treesQuery.data || treesQuery.data.length === 0) && (
                  <button
                    type="button"
                    className="welcome-card__btn"
                    onClick={startCreating}
                    disabled={creating || createMutation.isPending}
                  >
                    {t("welcome.createTree")}
                  </button>
                )}
              </div>
            </div>
          )}

          {creating && (
            <form className="tree-list-create" onSubmit={handleCreateSubmit}>
              <input
                className="tree-list-item__input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("tree.namePlaceholder")}
                autoFocus
              />
              <button
                className="tree-list-item__btn"
                type="submit"
                disabled={!newName.trim() || createMutation.isPending}
              >
                {t("tree.create")}
              </button>
              <button
                className="tree-list-item__btn"
                type="button"
                onClick={() => setCreating(false)}
              >
                {t(T_CANCEL)}
              </button>
            </form>
          )}

          {showDemoLimit && demoTreeCount >= MAX_DEMO_TREES && (
            <div className="tree-list-limit">
              <AlertTriangle size={16} />
              <span>{t("demo.limitReachedHint")}</span>
            </div>
          )}

          {importing && <p className="tree-list-loading">{t("tree.importing")}</p>}

          {importError && (
            <div className="tree-list-limit">
              <AlertTriangle size={16} />
              <span>{importError}</span>
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
                  {editingId === tree.id ? (
                    <form className="tree-list-item__edit" onSubmit={handleRenameSubmit}>
                      <input
                        className="tree-list-item__input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                      <button
                        className="tree-list-item__btn"
                        type="submit"
                        disabled={renameMutation.isPending}
                      >
                        {t("common.save")}
                      </button>
                      <button
                        className="tree-list-item__btn"
                        type="button"
                        onClick={() => setEditingId(null)}
                      >
                        {t(T_CANCEL)}
                      </button>
                    </form>
                  ) : deletingId === tree.id ? (
                    <div className="tree-list-item__confirm">
                      <span>{t("tree.confirmDelete")}</span>
                      <button
                        type="button"
                        className="tree-list-item__btn tree-list-item__btn--danger"
                        onClick={() => deleteMutation.mutate(tree.id)}
                        disabled={deleteMutation.isPending}
                      >
                        {t(T_DELETE)}
                      </button>
                      <button
                        type="button"
                        className="tree-list-item__btn"
                        onClick={() => setDeletingId(null)}
                      >
                        {t(T_CANCEL)}
                      </button>
                    </div>
                  ) : (
                    <div className="tree-list-item">
                      <Link
                        className="tree-list-item__link"
                        to={`/trees/${uuidToCompact(tree.id)}`}
                      >
                        {tree.name}
                        {tree.is_demo && (
                          <span className="tree-list-item__demo-badge">{t("demo.badge")}</span>
                        )}
                      </Link>
                      <div className="tree-list-item__actions">
                        <button
                          type="button"
                          className="tree-list-item__btn"
                          onClick={() => startEditing(tree)}
                          title={t("common.edit")}
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          type="button"
                          className="tree-list-item__btn tree-list-item__btn--danger"
                          onClick={() => setDeletingId(tree.id)}
                          title={t(T_DELETE)}
                        >
                          {t(T_DELETE)}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </>
  );
}
