import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getPatternColor, PATTERN_COLORS } from "../../lib/patternColors";

interface CreatePatternMiniFormProps {
  selectedCount: number;
  onSubmit: (name: string, description: string, color: string) => void;
  onCancel: () => void;
}

export function CreatePatternMiniForm({
  selectedCount,
  onSubmit,
  onCancel,
}: CreatePatternMiniFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PATTERN_COLORS[0]);

  function handleSubmit() {
    if (!name.trim()) return;
    onSubmit(name.trim(), description.trim(), color);
  }

  return (
    <div className="tl-create-pattern" data-testid="create-pattern-mini-form">
      <div className="tl-create-pattern__count">
        {t("timeline.selectedEvents", { count: selectedCount })}
      </div>

      <input
        type="text"
        className="detail-panel__input"
        placeholder={t("timeline.patternName")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        data-testid="pattern-mini-name"
      />

      <textarea
        className="detail-panel__input"
        placeholder={t("timeline.patternDescription")}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />

      <div className="tl-create-pattern__colors">
        {PATTERN_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`tl-create-pattern__color-dot${color === c ? " tl-create-pattern__color-dot--selected" : ""}`}
            style={{ backgroundColor: getPatternColor(c) }}
            onClick={() => setColor(c)}
            aria-label={c}
          />
        ))}
      </div>

      <div className="tl-create-pattern__actions">
        <button
          type="button"
          className="tree-toolbar__btn tree-toolbar__btn--active"
          onClick={handleSubmit}
          disabled={!name.trim()}
        >
          {t("timeline.createPattern")}
        </button>
        <button type="button" className="tree-toolbar__btn" onClick={onCancel}>
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
