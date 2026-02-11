import { useTranslation } from "react-i18next";

export default function TreeListPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t("tree.myTrees")}</h1>
      <p>{t("tree.empty")}</p>
    </div>
  );
}
