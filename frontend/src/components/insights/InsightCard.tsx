import {
  Activity,
  BarChart3,
  Calendar,
  Clock,
  Hash,
  Layers,
  type LucideIcon,
  Shield,
  Star,
  Sunrise,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Insight } from "../../lib/computeInsights";

const ICONS: Record<string, LucideIcon> = {
  layers: Layers,
  clock: Clock,
  calendar: Calendar,
  activity: Activity,
  "bar-chart": BarChart3,
  users: Users,
  hash: Hash,
  sunrise: Sunrise,
  shield: Shield,
  star: Star,
};

interface InsightCardProps {
  insight: Insight;
  index: number;
}

/** Resolve i18n values that themselves are translation keys (e.g. category names). */
function resolveValues(
  values: Record<string, string | number>,
  t: (key: string) => string,
): Record<string, string | number> {
  const resolved: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(values)) {
    if (
      typeof v === "string" &&
      (v.startsWith("trauma.") || v.startsWith("dsm.") || v.startsWith("turningPoint."))
    ) {
      resolved[k] = t(v);
    } else {
      resolved[k] = v;
    }
  }
  return resolved;
}

export function InsightCard({ insight, index }: InsightCardProps) {
  const { t } = useTranslation();
  const Icon = ICONS[insight.icon] ?? Layers;

  const titleValues = resolveValues(insight.titleValues, t);
  const message = t(insight.titleKey, titleValues);
  const detail = insight.detailKey
    ? t(insight.detailKey, resolveValues(insight.detailValues, t))
    : null;

  return (
    <div
      className="insight-card"
      style={{ animationDelay: `${index * 0.06}s` }}
      data-testid="insight-card"
    >
      <div className="insight-card__icon">
        <Icon size={16} />
      </div>
      <div className="insight-card__body">
        <p className="insight-card__message">{message}</p>
        {detail && <p className="insight-card__detail">{detail}</p>}
      </div>
    </div>
  );
}
