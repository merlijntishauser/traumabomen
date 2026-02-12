import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTrees, createTree, updateTree, deleteTree } from "../lib/api";
import { useEncryption } from "../contexts/EncryptionContext";
import { useLogout } from "../hooks/useLogout";
import { ThemeToggle } from "../components/ThemeToggle";
import "../components/tree/TreeCanvas.css";
import "../styles/tree-list.css";

interface DecryptedTree {
  id: string;
  name: string;
}

export default function TreeListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const logout = useLogout();
  const { encrypt, decrypt } = useEncryption();
  const queryClient = useQueryClient();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const treesQuery = useQuery({
    queryKey: ["trees"],
    queryFn: async () => {
      const responses = await getTrees();
      const trees: DecryptedTree[] = await Promise.all(
        responses.map(async (r) => {
          const data = await decrypt<{ name: string }>(r.encrypted_data);
          return { id: r.id, name: data.name };
        }),
      );
      return trees;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const encrypted_data = await encrypt({ name: t("tree.untitled") });
      return createTree({ encrypted_data });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["trees"] });
      navigate(`/trees/${response.id}`);
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const encrypted_data = await encrypt({ name });
      return updateTree(id, { encrypted_data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trees"] });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTree(id),
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

  return (
    <div className="tree-list-page" data-1p-ignore>
      <div className="tree-toolbar">
        <span className="tree-toolbar__title">{t("tree.myTrees")}</span>
        <div className="tree-toolbar__spacer" />
        <button
          className="tree-toolbar__btn tree-toolbar__btn--primary"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          {t("tree.create")}
        </button>
        <ThemeToggle className="tree-toolbar__btn" />
        <button
          className="tree-toolbar__btn"
          onClick={() => i18n.changeLanguage(i18n.language === "nl" ? "en" : "nl")}
        >
          {i18n.language === "nl" ? "EN" : "NL"}
        </button>
        <button className="tree-toolbar__btn" onClick={logout}>
          {t("nav.logout")}
        </button>
      </div>

      <div className="tree-list-content">
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
                      {t("common.cancel")}
                    </button>
                  </form>
                ) : deletingId === tree.id ? (
                  <div className="tree-list-item__confirm">
                    <span>{t("tree.confirmDelete")}</span>
                    <button
                      className="tree-list-item__btn tree-list-item__btn--danger"
                      onClick={() => deleteMutation.mutate(tree.id)}
                      disabled={deleteMutation.isPending}
                    >
                      {t("common.delete")}
                    </button>
                    <button
                      className="tree-list-item__btn"
                      onClick={() => setDeletingId(null)}
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                ) : (
                  <div className="tree-list-item">
                    <Link className="tree-list-item__link" to={`/trees/${tree.id}`}>
                      {tree.name}
                    </Link>
                    <div className="tree-list-item__actions">
                      <button
                        className="tree-list-item__btn"
                        onClick={() => startEditing(tree)}
                        title={t("common.edit")}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        className="tree-list-item__btn tree-list-item__btn--danger"
                        onClick={() => setDeletingId(tree.id)}
                        title={t("common.delete")}
                      >
                        {t("common.delete")}
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
  );
}
