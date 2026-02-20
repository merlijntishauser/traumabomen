import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreatePatternMiniForm } from "./CreatePatternMiniForm";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${JSON.stringify(opts)}` : key,
  }),
}));

vi.mock("../../lib/patternColors", () => ({
  PATTERN_COLORS: ["#818cf8", "#f472b6", "#34d399"],
  getPatternColor: (hex: string) => hex,
}));

describe("CreatePatternMiniForm", () => {
  const defaultProps = {
    selectedCount: 3,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders selected count", () => {
    render(<CreatePatternMiniForm {...defaultProps} />);
    expect(screen.getByTestId("create-pattern-mini-form")).toBeTruthy();
    expect(screen.getByText(/timeline\.selectedEvents/)).toBeTruthy();
  });

  it("renders name input and description textarea", () => {
    render(<CreatePatternMiniForm {...defaultProps} />);
    expect(screen.getByTestId("pattern-mini-name")).toBeTruthy();
    expect(screen.getByPlaceholderText("timeline.patternDescription")).toBeTruthy();
  });

  it("renders color dots for each pattern color", () => {
    render(<CreatePatternMiniForm {...defaultProps} />);
    const dots = screen.getAllByRole("button", { name: /^#/ });
    expect(dots).toHaveLength(3);
  });

  it("disables create button when name is empty", () => {
    render(<CreatePatternMiniForm {...defaultProps} />);
    const createBtn = screen.getByText("timeline.createPattern");
    expect(createBtn).toBeDisabled();
  });

  it("enables create button when name is filled", () => {
    render(<CreatePatternMiniForm {...defaultProps} />);
    const input = screen.getByTestId("pattern-mini-name");
    fireEvent.change(input, { target: { value: "My Pattern" } });
    const createBtn = screen.getByText("timeline.createPattern");
    expect(createBtn).not.toBeDisabled();
  });

  it("calls onSubmit with trimmed values on create", () => {
    const onSubmit = vi.fn();
    render(<CreatePatternMiniForm {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId("pattern-mini-name"), {
      target: { value: "  Test Pattern  " },
    });
    fireEvent.change(screen.getByPlaceholderText("timeline.patternDescription"), {
      target: { value: "  A description  " },
    });
    fireEvent.click(screen.getByText("timeline.createPattern"));

    expect(onSubmit).toHaveBeenCalledWith("Test Pattern", "A description", "#818cf8");
  });

  it("does not call onSubmit when name is whitespace only", () => {
    const onSubmit = vi.fn();
    render(<CreatePatternMiniForm {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByTestId("pattern-mini-name"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByText("timeline.createPattern"));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<CreatePatternMiniForm {...defaultProps} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("common.cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("selects a different color when dot is clicked", () => {
    const onSubmit = vi.fn();
    render(<CreatePatternMiniForm {...defaultProps} onSubmit={onSubmit} />);

    // Click the second color dot
    const dots = screen.getAllByRole("button", { name: /^#/ });
    fireEvent.click(dots[1]);

    // Fill name and submit to verify color changed
    fireEvent.change(screen.getByTestId("pattern-mini-name"), {
      target: { value: "Test" },
    });
    fireEvent.click(screen.getByText("timeline.createPattern"));

    expect(onSubmit).toHaveBeenCalledWith("Test", "", "#f472b6");
  });

  it("marks selected color dot with selected class", () => {
    render(<CreatePatternMiniForm {...defaultProps} />);
    const dots = screen.getAllByRole("button", { name: /^#/ });
    // First dot should be selected by default
    expect(dots[0].className).toContain("--selected");
    expect(dots[1].className).not.toContain("--selected");
  });

  it("handleSubmit guards against empty name even if button click bypasses disabled", () => {
    const onSubmit = vi.fn();
    render(<CreatePatternMiniForm {...defaultProps} onSubmit={onSubmit} />);

    // The create button is disabled when name is empty, but we force-dispatch
    // a click event on the DOM element to exercise the guard in handleSubmit.
    const createBtn = screen.getByText("timeline.createPattern");
    createBtn.removeAttribute("disabled");
    fireEvent.click(createBtn);

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
