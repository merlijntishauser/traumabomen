import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTrees, createTree } from "../lib/api";
import { useEncryption } from "../contexts/EncryptionContext";
import { useLogout } from "../hooks/useLogout";
import { ThemeToggle } from "../components/ThemeToggle";
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

  return (
    <div className="tree-list-page" data-1p-ignore>
      <header className="tree-list-header">
        <h1>{t("tree.myTrees")}</h1>
        <div className="tree-list-header__actions">
          <ThemeToggle className="tree-list-header__btn" />
          <button
            className="tree-list-header__btn"
            onClick={() => i18n.changeLanguage(i18n.language === "nl" ? "en" : "nl")}
          >
            {i18n.language === "nl" ? "EN" : "NL"}
          </button>
          <button className="tree-list-header__btn" onClick={logout}>
            {t("nav.logout")}
          </button>
        </div>
      </header>

      <button
        className="tree-list-create"
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending}
      >
        {t("tree.create")}
      </button>

      {treesQuery.isLoading && <p className="tree-list-loading">{t("common.loading")}</p>}

      {treesQuery.data && treesQuery.data.length === 0 && (
        <p className="tree-list-empty">{t("tree.empty")}</p>
      )}

      {treesQuery.data && treesQuery.data.length > 0 && (
        <ul className="tree-list">
          {treesQuery.data.map((tree) => (
            <li key={tree.id}>
              <Link to={`/trees/${tree.id}`}>
                {tree.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
