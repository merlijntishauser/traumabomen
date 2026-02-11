import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTrees, createTree } from "../lib/api";
import { useEncryption } from "../contexts/EncryptionContext";
import { useLogout } from "../hooks/useLogout";

interface DecryptedTree {
  id: string;
  name: string;
}

export default function TreeListPage() {
  const { t } = useTranslation();
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
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 24 }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <h1 style={{ margin: 0 }}>{t("tree.myTrees")}</h1>
        <button onClick={logout}>{t("nav.logout")}</button>
      </header>

      <button
        onClick={() => createMutation.mutate()}
        disabled={createMutation.isPending}
        style={{
          padding: "8px 16px",
          marginBottom: 24,
          cursor: "pointer",
        }}
      >
        {t("tree.create")}
      </button>

      {treesQuery.isLoading && <p>{t("common.loading")}</p>}

      {treesQuery.data && treesQuery.data.length === 0 && (
        <p>{t("tree.empty")}</p>
      )}

      {treesQuery.data && treesQuery.data.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {treesQuery.data.map((tree) => (
            <li
              key={tree.id}
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <Link
                to={`/trees/${tree.id}`}
                style={{ textDecoration: "none", color: "#3b82f6" }}
              >
                {tree.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
