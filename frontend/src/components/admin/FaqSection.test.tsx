import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as api from "../../lib/api";
import type { AdminFaqEntry } from "../../types/api";
import { FaqEntryCard, FaqSection } from "./FaqSection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("../../lib/api", () => ({
  getAdminFaq: vi.fn(),
  createFaqEntry: vi.fn(),
  updateFaqEntry: vi.fn(),
  deleteFaqEntry: vi.fn(),
}));

const mockApi = vi.mocked(api);

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

  it("edits every field and saves the full set", () => {
    const onSave = vi.fn();
    render(<FaqEntryCard entry={entry} isPending={false} onSave={onSave} onDelete={vi.fn()} />);

    fireEvent.change(screen.getByDisplayValue("Q"), { target: { value: "Q2" } });
    fireEvent.change(screen.getByDisplayValue("V"), { target: { value: "V2" } });
    fireEvent.change(screen.getByDisplayValue("A en"), { target: { value: "A en 2" } });
    fireEvent.change(screen.getByDisplayValue("A nl"), { target: { value: "A nl 2" } });
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByText("admin.faq.save"));
    expect(onSave).toHaveBeenCalledWith({
      question_en: "Q2",
      question_nl: "V2",
      answer_en: "A en 2",
      answer_nl: "A nl 2",
      sort_order: 5,
      published: true,
    });
  });

  it("requires confirmation before deleting", () => {
    const onDelete = vi.fn();
    render(<FaqEntryCard entry={entry} isPending={false} onSave={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByText("admin.faq.delete"));
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("admin.faq.confirmDelete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("can cancel the delete confirmation", () => {
    const onDelete = vi.fn();
    render(<FaqEntryCard entry={entry} isPending={false} onSave={vi.fn()} onDelete={onDelete} />);

    fireEvent.click(screen.getByText("admin.faq.delete"));
    fireEvent.click(screen.getByText("common.cancel"));

    expect(screen.getByText("admin.faq.delete")).toBeInTheDocument();
    expect(screen.queryByText("admin.faq.confirmDelete")).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("re-syncs the form (and resets delete) when the entry prop changes", () => {
    const { rerender } = render(
      <FaqEntryCard entry={entry} isPending={false} onSave={vi.fn()} onDelete={vi.fn()} />,
    );

    fireEvent.change(screen.getByDisplayValue("Q"), { target: { value: "local edit" } });
    fireEvent.click(screen.getByText("admin.faq.delete"));
    expect(screen.getByText("admin.faq.confirmDelete")).toBeInTheDocument();

    const next: AdminFaqEntry = { ...entry, question_en: "Server Q", published: true };
    rerender(<FaqEntryCard entry={next} isPending={false} onSave={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByDisplayValue("Server Q")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("local edit")).not.toBeInTheDocument();
    // Delete confirmation was reset by the re-sync.
    expect(screen.getByText("admin.faq.delete")).toBeInTheDocument();
  });

  it("disables all controls while a mutation is pending", () => {
    render(<FaqEntryCard entry={entry} isPending={true} onSave={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByDisplayValue("Q")).toBeDisabled();
    expect(screen.getByText("admin.faq.delete")).toBeDisabled();
  });
});

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FaqSection />
    </QueryClientProvider>,
  );
}

describe("FaqSection", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows the loading state", () => {
    mockApi.getAdminFaq.mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("shows the error state when the query fails", async () => {
    mockApi.getAdminFaq.mockRejectedValue(new Error("boom"));
    renderSection();
    expect(await screen.findByText("admin.loadError")).toBeInTheDocument();
  });

  it("shows the empty state with an add button", async () => {
    mockApi.getAdminFaq.mockResolvedValue({ entries: [] });
    renderSection();
    expect(await screen.findByText("admin.faq.empty")).toBeInTheDocument();
    expect(screen.getByText("admin.faq.add")).toBeInTheDocument();
  });

  it("renders entries and creates a new one with the next sort order", async () => {
    mockApi.getAdminFaq.mockResolvedValue({ entries: [entry] });
    mockApi.createFaqEntry.mockResolvedValue({ ...entry, id: "2" });
    renderSection();

    expect(await screen.findByDisplayValue("Q")).toBeInTheDocument();
    fireEvent.click(screen.getByText("admin.faq.add"));

    await waitFor(() => expect(mockApi.createFaqEntry).toHaveBeenCalled());
    expect(mockApi.createFaqEntry.mock.calls[0][0]).toEqual(
      expect.objectContaining({ sort_order: 2, published: false }),
    );
  });

  it("saves an edited entry through updateFaqEntry", async () => {
    mockApi.getAdminFaq.mockResolvedValue({ entries: [entry] });
    mockApi.updateFaqEntry.mockResolvedValue(entry);
    renderSection();

    fireEvent.change(await screen.findByDisplayValue("Q"), { target: { value: "Q edited" } });
    fireEvent.click(screen.getByText("admin.faq.save"));

    await waitFor(() =>
      expect(mockApi.updateFaqEntry).toHaveBeenCalledWith(
        "1",
        expect.objectContaining({ question_en: "Q edited" }),
      ),
    );
  });

  it("deletes an entry through deleteFaqEntry", async () => {
    mockApi.getAdminFaq.mockResolvedValue({ entries: [entry] });
    mockApi.deleteFaqEntry.mockResolvedValue(undefined);
    renderSection();

    await screen.findByDisplayValue("Q");
    fireEvent.click(screen.getByText("admin.faq.delete"));
    fireEvent.click(screen.getByText("admin.faq.confirmDelete"));

    await waitFor(() => expect(mockApi.deleteFaqEntry).toHaveBeenCalled());
    expect(mockApi.deleteFaqEntry.mock.calls[0][0]).toBe("1");
  });
});
