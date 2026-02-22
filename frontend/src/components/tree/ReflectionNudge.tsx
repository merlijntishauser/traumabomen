import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getNudgePrompt } from "../../lib/reflectionPrompts";

interface ReflectionNudgeProps {
  onOpenJournal: (promptText: string) => void;
}

export function ReflectionNudge({ onOpenJournal }: ReflectionNudgeProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  // Pick one random prompt, stable for the session (empty deps)
  // biome-ignore lint/correctness/useExhaustiveDependencies: stable per mount
  const prompt = useMemo(() => getNudgePrompt(t), []);

  if (dismissed) return null;

  return (
    <div className="reflection-nudge" data-testid="reflection-nudge">
      <span className="reflection-nudge__text">{prompt}</span>
      <button type="button" className="reflection-nudge__btn" onClick={() => onOpenJournal(prompt)}>
        {t("prompt.nudge.writeAbout")}
      </button>
      <button
        type="button"
        className="reflection-nudge__dismiss"
        onClick={() => setDismissed(true)}
        aria-label={t("prompt.nudge.dismiss")}
      >
        <X size={14} />
      </button>
    </div>
  );
}
