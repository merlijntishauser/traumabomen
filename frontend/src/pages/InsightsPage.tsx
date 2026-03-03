import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { InsightCard } from "../components/insights/InsightCard";
import { computeGenerations } from "../components/timeline/timelineHelpers";
import { ThemeLanguageSettings } from "../components/tree/ThemeLanguageSettings";
import { TreeToolbar } from "../components/tree/TreeToolbar";
import { useTreeData } from "../hooks/useTreeData";
import { useTreeId } from "../hooks/useTreeId";
import { computeInsights, type Insight } from "../lib/computeInsights";
import "../components/tree/TreeCanvas.css";
import "./InsightsPage.css";

const SECTION_ORDER: Insight["category"][] = ["generational", "temporal", "summary", "resilience"];

const SECTION_KEYS: Record<Insight["category"], string> = {
  generational: "insights.sectionGenerational",
  temporal: "insights.sectionTemporal",
  summary: "insights.sectionSummary",
  resilience: "insights.sectionResilience",
};

export default function InsightsPage() {
  const treeId = useTreeId();
  const { t } = useTranslation();
  const {
    treeName,
    persons,
    relationships,
    events,
    lifeEvents,
    turningPoints,
    classifications,
    isLoading,
    error,
  } = useTreeData(treeId!);

  const viewTab = useMemo(
    () => ({
      label: t("insights.tab"),
      content: <ThemeLanguageSettings />,
    }),
    [t],
  );

  const generations = useMemo(
    () => computeGenerations(persons, relationships),
    [persons, relationships],
  );

  const insights = useMemo(
    () =>
      computeInsights({
        persons,
        events,
        lifeEvents,
        turningPoints,
        classifications,
        generations,
      }),
    [persons, events, lifeEvents, turningPoints, classifications, generations],
  );

  const groupedInsights = useMemo(() => {
    const groups = new Map<Insight["category"], Insight[]>();
    for (const insight of insights) {
      const list = groups.get(insight.category) ?? [];
      list.push(insight);
      groups.set(insight.category, list);
    }
    return groups;
  }, [insights]);

  if (error) {
    return (
      <div className="tree-workspace">
        <TreeToolbar treeId={treeId!} treeName={treeName} activeView="insights" viewTab={viewTab} />
        <div style={{ padding: 20 }}>{t("tree.decryptionError")}</div>
      </div>
    );
  }

  const hasInsights = insights.length > 0;
  let cardIndex = 0;

  return (
    <div className="tree-workspace">
      <TreeToolbar treeId={treeId!} treeName={treeName} activeView="insights" viewTab={viewTab} />

      {isLoading ? (
        <div style={{ padding: 20 }}>{t("common.loading")}</div>
      ) : (
        <div className="insights-page">
          <div className="insights-page__header">
            <h1 className="insights-page__title">{t("insights.title")}</h1>
            <p className="insights-page__subtitle">{t("insights.subtitle")}</p>
          </div>

          {!hasInsights && (
            <div className="insights-page__empty" data-testid="insights-empty">
              {t("insights.empty")}
            </div>
          )}

          {SECTION_ORDER.map((category) => {
            const sectionInsights = groupedInsights.get(category);
            if (!sectionInsights || sectionInsights.length === 0) return null;
            return (
              <section
                key={category}
                className="insights-page__section"
                data-testid={`insights-section-${category}`}
              >
                <h2 className="insights-page__section-title">{t(SECTION_KEYS[category])}</h2>
                <div className="insights-page__grid">
                  {sectionInsights.map((insight) => {
                    const idx = cardIndex++;
                    return (
                      <InsightCard
                        key={`${insight.titleKey}-${JSON.stringify(insight.titleValues)}`}
                        insight={insight}
                        index={idx}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
