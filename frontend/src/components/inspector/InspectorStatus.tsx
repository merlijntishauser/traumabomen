import { Check } from "lucide-react";
import { createContext, use, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SaveOutcome, SaveReporter } from "../../hooks/useAutosaveForm";
import "./inspector.css";

export type SaveStatus = "idle" | SaveOutcome;

const InspectorStatusContext = createContext<SaveReporter | undefined>(undefined);

export const InspectorStatusProvider = InspectorStatusContext.Provider;

/** Autosave forms report their outcome here; undefined outside a provider. */
export function useSaveReporter(): SaveReporter | undefined {
  return use(InspectorStatusContext);
}

/** Panel-level whisper state: "saved" fades back to idle, "error" persists. */
export function useInspectorStatus(): { status: SaveStatus; report: SaveReporter } {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const report = useCallback((outcome: SaveOutcome) => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setStatus(outcome);
    if (outcome === "saved") {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setStatus("idle");
      }, 1800);
    }
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current != null) clearTimeout(timerRef.current);
    },
    [],
  );

  return { status, report };
}

/**
 * The saved whisper: transient confirmation in the panel header. Fades on
 * opacity only. The text stays mounted through the fade-out; errors persist
 * until the next successful save.
 */
export function InspectorSaveWhisper({ status }: { status: SaveStatus }) {
  const { t } = useTranslation();
  const isError = status === "error";
  const visible = status !== "idle";
  return (
    <span
      className={`inspector-whisper${visible ? " inspector-whisper--visible" : ""}${
        isError ? " inspector-whisper--error" : ""
      }`}
      aria-live="polite"
    >
      {isError ? (
        t("inspector.saveFailed")
      ) : (
        <>
          <Check size={12} aria-hidden="true" />
          {t("inspector.saved")}
        </>
      )}
    </span>
  );
}
