import { useCallback, useEffect, useRef, useState } from "react";
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

export function FeedbackModal({ onClose }: Props) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<FeedbackCreate["category"]>("general");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleClose = useCallback(() => {
    if (!submitting) onClose();
  }, [submitting, onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [success, onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) handleClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || submitting) return;

    setSubmitting(true);
    try {
      await submitFeedback({ category, message: message.trim(), anonymous });
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = message.trim().length > 0 && !submitting;

  return createPortal(
    <div
      className="feedback-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={t("feedback.title")}
    >
      <div className="feedback-card">
        {success ? (
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
                    checked={category === cat}
                    onChange={() => setCategory(cat)}
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
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))}
                placeholder={t("feedback.messagePlaceholder")}
                maxLength={MAX_MESSAGE_LENGTH}
              />
              <div className="feedback-message__counter">
                {t("feedback.charCount", { count: message.length, max: MAX_MESSAGE_LENGTH })}
              </div>
            </div>

            <div className="feedback-anonymous">
              <label className="feedback-anonymous__toggle">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
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
                disabled={submitting}
              >
                {t("common.cancel")}
              </button>
              <button type="submit" className="feedback-actions__submit" disabled={!canSubmit}>
                {submitting ? t("feedback.sending") : t("feedback.submit")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
