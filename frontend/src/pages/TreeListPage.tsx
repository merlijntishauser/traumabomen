import { useTranslation } from "react-i18next";
import { useLogout } from "../hooks/useLogout";

export default function TreeListPage() {
  const { t } = useTranslation();
  const logout = useLogout();

  return (
    <div>
      <header>
        <h1>{t("tree.myTrees")}</h1>
        <button onClick={logout}>{t("nav.logout")}</button>
      </header>
      <p>{t("tree.empty")}</p>
    </div>
  );
}
