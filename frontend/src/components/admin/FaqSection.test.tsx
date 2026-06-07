import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AdminFaqEntry } from "../../types/api";
import { FaqEntryCard } from "./FaqSection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const entry: AdminFaqEntry = {
  id: "1",
  question_en: "Q",
  answer_en: "A en",
  question_nl: "V",
  answer_nl: "A nl",
  sort_order: 1,
  published: false,
};

describe("FaqEntryCard", () => {
  it("renders the entry fields in both languages", () => {
    render(<FaqEntryCard entry={entry} isPending={false} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByDisplayValue("Q")).toBeInTheDocument();
    expect(screen.getByDisplayValue("V")).toBeInTheDocument();
    expect(screen.getByDisplayValue("A en")).toBeInTheDocument();
  });

  it("disables save until a field changes, then saves the edited values", () => {
    const onSave = vi.fn();
    render(<FaqEntryCard entry={entry} isPending={false} onSave={onSave} onDelete={vi.fn()} />);

    const saveButton = screen.getByText("admin.faq.save");
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByDisplayValue("Q"), { target: { value: "Q updated" } });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ question_en: "Q updated" }));
  });

  it("requires confirmation before deleting", () => {
    const onDelete = vi.fn();
    render(<FaqEntryCard entry={entry} isPending={false} onSave={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByText("admin.faq.delete"));
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("admin.faq.confirmDelete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("disables all controls while a mutation is pending", () => {
    render(<FaqEntryCard entry={entry} isPending={true} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByDisplayValue("Q")).toBeDisabled();
    expect(screen.getByText("admin.faq.delete")).toBeDisabled();
  });
});
