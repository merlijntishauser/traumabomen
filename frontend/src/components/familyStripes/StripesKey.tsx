import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { keyOf, type StripeEntry, stripeColor } from "../../lib/familyStripes";
import { LifeEventCategory, TraumaCategory, TurningPointCategory } from "../../types/domain";
import { StripeMark } from "./StripeMark";

interface KeyItem {
  key: string;
  label: string;
  swatch: ReactNode;
}

function hatch(color: string): string {
  return `repeating-linear-gradient(45deg, ${color} 0 2px, var(--color-stripe-lived) 2px 4.5px)`;
}

function fillSwatch(background: string, height = 12) {
  return <span className="fs-key__swatch" style={{ background, height }} aria-hidden="true" />;
}

function traumaItems(used: Set<string>, entries: StripeEntry[], t: TFunction): KeyItem[] {
  const items: KeyItem[] = [];
  for (const c of Object.values(TraumaCategory)) {
    if (!used.has(`trauma_event:${c}`)) continue;
    items.push({
      key: `trauma_event:${c}`,
      label: t(`trauma.category.${c}`),
      swatch: fillSwatch(stripeColor({ kind: "trauma_event", category: c })),
    });
  }
  if (entries.some((e) => e.approx)) {
    items.push({
      key: "approx",
      label: t("timeline.key.approx"),
      swatch: fillSwatch(hatch("var(--color-text-secondary)")),
    });
  }
  return items;
}

function lifeItems(used: Set<string>, t: TFunction): KeyItem[] {
  const items: KeyItem[] = [];
  for (const c of Object.values(LifeEventCategory)) {
    if (!used.has(`life_event:${c}`)) continue;
    items.push({
      key: `life_event:${c}`,
      label: t(`lifeEvent.category.${c}`),
      swatch: (
        <StripeMark
          kind="life_event"
          size={10}
          color={stripeColor({ kind: "life_event", category: c })}
        />
      ),
    });
  }
  return items;
}

function markItems(used: Set<string>, t: TFunction): KeyItem[] {
  const items: KeyItem[] = [];
  if (used.has("classification:diagnosed")) {
    items.push({
      key: "classification:diagnosed",
      label: t("classification.status.diagnosed"),
      swatch: fillSwatch("var(--color-classification-diagnosed)", 4),
    });
  }
  if (used.has("classification:suspected")) {
    items.push({
      key: "classification:suspected",
      label: t("classification.status.suspected"),
      swatch: fillSwatch(hatch("var(--color-classification-suspected)"), 4),
    });
  }
  return items;
}

function turningPointItems(used: Set<string>, t: TFunction): KeyItem[] {
  const items: KeyItem[] = [];
  for (const c of Object.values(TurningPointCategory)) {
    const key = keyOf({ kind: "turning_point", category: c });
    if (!used.has(key)) continue;
    items.push({
      key,
      label: t(`turningPoint.category.${c}`),
      swatch: (
        <StripeMark
          kind="turning_point"
          size={12}
          color={stripeColor({ kind: "turning_point", category: c })}
        />
      ),
    });
  }
  return items;
}

export interface StripesKeyProps {
  entries: StripeEntry[];
  /** Key items whose entries are lit, or null when nothing is highlighted. */
  litKeys: Set<string> | null;
  pinnedKey: string | null;
  onHoverKey: (key: string | null) => void;
  onTogglePin: (key: string) => void;
}

/** The key: hover an item to light up everything it describes, click to keep it lit. */
export function StripesKey({
  entries,
  litKeys,
  pinnedKey,
  onHoverKey,
  onTogglePin,
}: StripesKeyProps) {
  const { t } = useTranslation();
  const used = new Set(entries.map(keyOf));
  const sets = [
    { label: t("timeline.key.trauma"), items: traumaItems(used, entries, t) },
    { label: t("timeline.key.life"), items: lifeItems(used, t) },
    { label: t("timeline.key.marks"), items: markItems(used, t) },
    { label: t("timeline.key.turningPoints"), items: turningPointItems(used, t) },
  ].filter((set) => set.items.length > 0);
  if (sets.length === 0) return null;
  return (
    <ul className="fs-key" aria-label={t("timeline.key.label")}>
      {sets.map((set) => (
        <li key={set.label} className="fs-key__set">
          <span className="fs-key__label">{set.label}</span>
          {set.items.map((item) => (
            <button
              key={item.key}
              type="button"
              className={litKeys && !litKeys.has(item.key) ? "fs-key__item is-dim" : "fs-key__item"}
              aria-pressed={pinnedKey === item.key}
              onPointerEnter={() => onHoverKey(item.key)}
              onPointerLeave={() => onHoverKey(null)}
              onFocus={() => onHoverKey(item.key)}
              onBlur={() => onHoverKey(null)}
              onClick={() => onTogglePin(item.key)}
            >
              {item.swatch}
              {item.label}
            </button>
          ))}
        </li>
      ))}
    </ul>
  );
}
