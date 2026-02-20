import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeedbackModal } from "./FeedbackModal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, params?: Record<string, unknown>) => {
      if (params && "count" in params && "max" in params) return `${params.count} / ${params.max}`;
      return k;
    },
    i18n: { language: "en" },
  }),
}));

const mockSubmitFeedback = vi.fn().mockResolvedValue(undefined);
vi.mock("../lib/api", () => ({
  submitFeedback: (...args: unknown[]) => mockSubmitFeedback(...args),
}));

describe("FeedbackModal", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with category radios, textarea, and anonymous checkbox", () => {
    render(<FeedbackModal onClose={onClose} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("feedback.title")).toBeInTheDocument();
    expect(screen.getByText("feedback.categoryBug")).toBeInTheDocument();
    expect(screen.getByText("feedback.categoryFeature")).toBeInTheDocument();
    expect(screen.getByText("feedback.categoryGeneral")).toBeInTheDocument();
    expect(screen.getByLabelText("feedback.message")).toBeInTheDocument();
    expect(screen.getByText("feedback.anonymous")).toBeInTheDocument();
  });

  it("submit button is disabled when message is empty", () => {
    render(<FeedbackModal onClose={onClose} />);
    const submit = screen.getByText("feedback.submit");
    expect(submit).toBeDisabled();
  });

  it("submit button is enabled when message is non-empty", () => {
    render(<FeedbackModal onClose={onClose} />);
    const textarea = screen.getByLabelText("feedback.message");
    fireEvent.change(textarea, { target: { value: "Test message" } });
    const submit = screen.getByText("feedback.submit");
    expect(submit).not.toBeDisabled();
  });

  it("calls submitFeedback API on submit", async () => {
    render(<FeedbackModal onClose={onClose} />);
    const textarea = screen.getByLabelText("feedback.message");
    fireEvent.change(textarea, { target: { value: "Test message" } });

    const submit = screen.getByText("feedback.submit");
    fireEvent.click(submit);

    await waitFor(() => {
      expect(mockSubmitFeedback).toHaveBeenCalledWith({
        category: "general",
        message: "Test message",
        anonymous: false,
      });
    });
  });

  it("shows success message after submit", async () => {
    render(<FeedbackModal onClose={onClose} />);
    const textarea = screen.getByLabelText("feedback.message");
    fireEvent.change(textarea, { target: { value: "Test" } });
    fireEvent.click(screen.getByText("feedback.submit"));

    await waitFor(() => {
      expect(screen.getByText("feedback.success")).toBeInTheDocument();
    });
  });

  it("closes on Escape key", () => {
    render(<FeedbackModal onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on click outside", () => {
    render(<FeedbackModal onClose={onClose} />);
    // The overlay div has role="dialog" -- clicking on it (not the card) should close
    const overlay = screen.getByRole("dialog");
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it("submits with anonymous flag when checkbox is checked", async () => {
    render(<FeedbackModal onClose={onClose} />);
    const textarea = screen.getByLabelText("feedback.message");
    fireEvent.change(textarea, { target: { value: "Anonymous feedback" } });

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByText("feedback.submit"));

    await waitFor(() => {
      expect(mockSubmitFeedback).toHaveBeenCalledWith({
        category: "general",
        message: "Anonymous feedback",
        anonymous: true,
      });
    });
  });

  it("switching category radio changes submitted category", async () => {
    render(<FeedbackModal onClose={onClose} />);
    const textarea = screen.getByLabelText("feedback.message");
    fireEvent.change(textarea, { target: { value: "Bug report" } });

    // Click "bug" category radio
    const bugRadio = screen.getByRole("radio", { name: /feedback.categoryBug/ });
    fireEvent.click(bugRadio);

    fireEvent.click(screen.getByText("feedback.submit"));

    await waitFor(() => {
      expect(mockSubmitFeedback).toHaveBeenCalledWith(expect.objectContaining({ category: "bug" }));
    });
  });

  it("displays character counter", () => {
    render(<FeedbackModal onClose={onClose} />);
    expect(screen.getByText("0 / 2000")).toBeInTheDocument();

    const textarea = screen.getByLabelText("feedback.message");
    fireEvent.change(textarea, { target: { value: "Hello" } });
    expect(screen.getByText("5 / 2000")).toBeInTheDocument();
  });
});
