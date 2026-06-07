import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createFaqEntry, deleteFaqEntry, getAdminFaq, updateFaqEntry } from "../../lib/api";
import type { AdminFaqEntry, FaqEntryInput } from "../../types/api";

const QUERY_KEY = ["admin", "faq"];

function toInput(entry: AdminFaqEntry): FaqEntryInput {
  return {
    question_en: entry.question_en,
    answer_en: entry.answer_en,
    question_nl: entry.question_nl,
    answer_nl: entry.answer_nl,
    sort_order: entry.sort_order,
    published: entry.published,
  };
}

/** @internal Exported for testing */
export function FaqEntryCard({
  entry,
  isPending,
  onSave,
  onDelete,
}: {
  entry: AdminFaqEntry;
  isPending: boolean;
  onSave: (body: FaqEntryInput) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FaqEntryInput>(() => toInput(entry));
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Re-sync the editable fields when the server entry changes (e.g. after a
  // save refetches the list). Done with a render-phase previous-value
  // comparison rather than an effect.
  const prevEntryRef = useRef(entry);
  if (prevEntryRef.current !== entry) {
    prevEntryRef.current = entry;
    setForm(toInput(entry));
    setConfirmingDelete(false);
  }

  function set<K extends keyof FaqEntryInput>(key: K, value: FaqEntryInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(toInput(entry));

  return (
    <div className="admin-faq-card">
      <div className="admin-faq-card__grid">
        <label className="admin-faq-field">
          <span className="admin-faq-field__label">{t("admin.faq.questionEn")}</span>
          <input
            className="admin-faq-field__input"
            value={form.question_en}
            onChange={(e) => set("question_en", e.target.value)}
            disabled={isPending}
          />
        </label>
        <label className="admin-faq-field">
          <span className="admin-faq-field__label">{t("admin.faq.questionNl")}</span>
          <input
            className="admin-faq-field__input"
            value={form.question_nl}
            onChange={(e) => set("question_nl", e.target.value)}
            disabled={isPending}
          />
        </label>
        <label className="admin-faq-field">
          <span className="admin-faq-field__label">{t("admin.faq.answerEn")}</span>
          <textarea
            className="admin-faq-field__textarea"
            value={form.answer_en}
            onChange={(e) => set("answer_en", e.target.value)}
            disabled={isPending}
            rows={3}
          />
        </label>
        <label className="admin-faq-field">
          <span className="admin-faq-field__label">{t("admin.faq.answerNl")}</span>
          <textarea
            className="admin-faq-field__textarea"
            value={form.answer_nl}
            onChange={(e) => set("answer_nl", e.target.value)}
            disabled={isPending}
            rows={3}
          />
        </label>
      </div>

      <div className="admin-faq-card__controls">
        <label className="admin-faq-inline">
          <span className="admin-faq-field__label">{t("admin.faq.order")}</span>
          <input
            className="admin-faq-inline__number"
            type="number"
            min={0}
            value={form.sort_order}
            onChange={(e) => set("sort_order", Number(e.target.value))}
            disabled={isPending}
          />
        </label>
        <label className="admin-faq-inline">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(e) => set("published", e.target.checked)}
            disabled={isPending}
          />
          <span>{t("admin.faq.published")}</span>
        </label>

        <div className="admin-faq-card__actions">
          <button
            type="button"
            className="admin-faq-btn admin-faq-btn--save"
            onClick={() => onSave(form)}
            disabled={isPending || !dirty}
          >
            {t("admin.faq.save")}
          </button>
          {confirmingDelete ? (
            <>
              <button
                type="button"
                className="admin-faq-btn admin-faq-btn--delete"
                onClick={onDelete}
                disabled={isPending}
              >
                {t("admin.faq.confirmDelete")}
              </button>
              <button
                type="button"
                className="admin-faq-btn admin-faq-btn--neutral"
                onClick={() => setConfirmingDelete(false)}
                disabled={isPending}
              >
                {t("common.cancel")}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="admin-faq-btn admin-faq-btn--delete"
              onClick={() => setConfirmingDelete(true)}
              disabled={isPending}
            >
              {t("admin.faq.delete")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function FaqSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: QUERY_KEY, queryFn: getAdminFaq });

  const createMutation = useMutation({
    mutationFn: createFaqEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: FaqEntryInput }) => updateFaqEntry(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteFaqEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const entries = data?.entries ?? [];
  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  function handleAdd() {
    const nextOrder = entries.reduce((max, e) => Math.max(max, e.sort_order), 0) + 1;
    createMutation.mutate({
      question_en: t("admin.faq.newQuestion"),
      answer_en: t("admin.faq.newAnswer"),
      question_nl: t("admin.faq.newQuestion"),
      answer_nl: t("admin.faq.newAnswer"),
      sort_order: nextOrder,
      published: false,
    });
  }

  return (
    <section>
      <div className="admin-section__title">{t("admin.faq.title")}</div>
      {isLoading && <div className="admin-loading">{t("common.loading")}</div>}
      {error && <div className="admin-error">{t("admin.loadError")}</div>}
      {!isLoading && !error && (
        <div className="admin-faq">
          {entries.length === 0 && <p className="admin-faq__empty">{t("admin.faq.empty")}</p>}
          {entries.map((entry) => (
            <FaqEntryCard
              key={entry.id}
              entry={entry}
              isPending={isPending}
              onSave={(body) => updateMutation.mutate({ id: entry.id, body })}
              onDelete={() => deleteMutation.mutate(entry.id)}
            />
          ))}
          <button
            type="button"
            className="admin-faq-btn admin-faq-btn--neutral"
            onClick={handleAdd}
            disabled={isPending}
          >
            {t("admin.faq.add")}
          </button>
        </div>
      )}
    </section>
  );
}
