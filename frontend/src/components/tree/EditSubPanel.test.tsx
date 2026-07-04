import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditSubPanel } from "./EditSubPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe("EditSubPanel", () => {
  it("renders title and children", () => {
    render(
      <EditSubPanel title="Edit Event" onBack={vi.fn()}>
        <p>Form content</p>
      </EditSubPanel>,
    );

    expect(screen.getByText("Edit Event")).toBeInTheDocument();
    expect(screen.getByText("Form content")).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", () => {
    const onBack = vi.fn();
    render(
      <EditSubPanel title="Edit Event" onBack={onBack}>
        <p>Content</p>
      </EditSubPanel>,
    );

    fireEvent.click(screen.getByLabelText("common.close"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("labels the back control Cancel by default (creation discards)", () => {
    render(
      <EditSubPanel title="New" onBack={vi.fn()}>
        <p>Content</p>
      </EditSubPanel>,
    );

    expect(screen.getByText("common.cancel")).toBeInTheDocument();
  });

  it("uses the provided closeLabel (editing autosaves, Close is honest)", () => {
    render(
      <EditSubPanel title="Edit" onBack={vi.fn()} closeLabel="common.close">
        <p>Content</p>
      </EditSubPanel>,
    );

    expect(screen.getByText("common.close")).toBeInTheDocument();
    expect(screen.queryByText("common.cancel")).not.toBeInTheDocument();
  });
});
