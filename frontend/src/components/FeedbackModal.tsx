import { useCallback, useEffect, useReducer, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { submitFeedback } from "../lib/api";
import type { FeedbackCreate } from "../types/api";
import "../styles/feedback.css";

const MAX_MESSAGE_LENGTH = 2000;
const CATEGORIES = ["bug", "feature", "general"] as const;

interface Props {
  onClose: () => void;
}

interface FeedbackState {
  category: FeedbackCreate["category"];
  message: string;
  anonymous: boolean;
  submitting: boolean;
  success: boolean;
}

type FeedbackAction =
  | { type: "SET_CATEGORY"; category: FeedbackCreate["category"] }
  | { type: "SET_MESSAGE"; message: string }
  | { type: "SET_ANONYMOUS"; anonymous: boolean }
  | { type: "SET_SUBMITTING"; submitting: boolean }
  | { type: "SET_SUCCESS" };

const feedbackInitialState: FeedbackState = {
  category: "general",
  message: "",
  anonymous: false,
  submitting: false,
  success: false,
};

function feedbackReducer(state: FeedbackState, action: FeedbackAction): FeedbackState {
  switch (action.type) {
    case "SET_CATEGORY":
      return { ...state, category: action.category };
    case "SET_MESSAGE":
      return { ...state, message: action.message };
    case "SET_ANONYMOUS":
      return { ...state, anonymous: action.anonymous };
    case "SET_SUBMITTING":
      return { ...state, submitting: action.submitting };
    case "SET_SUCCESS":
      return { ...state, success: true };
  }
}

export function FeedbackModal({ onClose }: Props) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(feedbackReducer, feedbackInitialState);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    if (!state.submitting) onClose();
  }, [state.submitting, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  useEffect(() => {
    if (!state.success) return;
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [state.success, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) handleClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.message.trim() || state.submitting) return;

    dispatch({ type: "SET_SUBMITTING", submitting: true });
    try {
      await submitFeedback({
        category: state.category,
        message: state.message.trim(),
        anonymous: state.anonymous,
      });
      dispatch({ type: "SET_SUCCESS" });
    } finally {
      dispatch({ type: "SET_SUBMITTING", submitting: false });
    }
  };

  const canSubmit = state.message.trim().length > 0 && !state.submitting;

  return createPortal(
    <div
      className="feedback-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      onKeyDown={(e) => {
        if (e.key === "Escape") handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t("feedback.title")}
    >
      <div className="feedback-card">
        {state.success ? (
          <div className="feedback-success">{t("feedback.success")}</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 className="feedback-card__title">{t("feedback.title")}</h2>

            <div className="feedback-categories">
              <div className="feedback-categories__label">{t("feedback.category")}</div>
              {CATEGORIES.map((cat) => (
                <label key={cat} className="feedback-radio">
                  <input
                    type="radio"
                    name="feedback-category"
                    value={cat}
                    checked={state.category === cat}
                    onChange={() => dispatch({ type: "SET_CATEGORY", category: cat })}
                  />
                  {t(`feedback.category${cat.charAt(0).toUpperCase()}${cat.slice(1)}`)}
                </label>
              ))}
            </div>

            <div className="feedback-message">
              <label className="feedback-message__label" htmlFor="feedback-message">
                {t("feedback.message")}
              </label>
              <textarea
                id="feedback-message"
                className="feedback-message__textarea"
                value={state.message}
                onChange={(e) =>
                  dispatch({
                    type: "SET_MESSAGE",
                    message: e.target.value.slice(0, MAX_MESSAGE_LENGTH),
                  })
                }
                placeholder={t("feedback.messagePlaceholder")}
                maxLength={MAX_MESSAGE_LENGTH}
              />
              <div className="feedback-message__counter">
                {t("feedback.charCount", {
                  count: state.message.length,
                  max: MAX_MESSAGE_LENGTH,
                })}
              </div>
            </div>

            <div className="feedback-anonymous">
              <label className="feedback-anonymous__toggle">
                <input
                  type="checkbox"
                  checked={state.anonymous}
                  onChange={(e) => dispatch({ type: "SET_ANONYMOUS", anonymous: e.target.checked })}
                />
                {t("feedback.anonymous")}
              </label>
              <div className="feedback-anonymous__note">{t("feedback.anonymousNote")}</div>
            </div>

            <div className="feedback-actions">
              <button
                type="button"
                className="feedback-actions__cancel"
                onClick={handleClose}
                disabled={state.submitting}
              >
                {t("common.cancel")}
              </button>
              <button type="submit" className="feedback-actions__submit" disabled={!canSubmit}>
                {state.submitting ? t("feedback.sending") : t("feedback.submit")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
