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

  it("renders save button when onSave is provided", () => {
    render(
      <EditSubPanel title="Edit" onBack={vi.fn()} onSave={vi.fn()}>
        <p>Content</p>
      </EditSubPanel>,
    );

    expect(screen.getByText("common.save")).toBeInTheDocument();
  });

  it("does not render footer when neither onSave nor onDelete is provided", () => {
    const { container } = render(
      <EditSubPanel title="Edit" onBack={vi.fn()}>
        <p>Content</p>
      </EditSubPanel>,
    );

    expect(container.querySelector(".detail-panel__sub-footer")).not.toBeInTheDocument();
  });

  it("calls onSave when save button is clicked", () => {
    const onSave = vi.fn();
    render(
      <EditSubPanel title="Edit" onBack={vi.fn()} onSave={onSave}>
        <p>Content</p>
      </EditSubPanel>,
    );

    fireEvent.click(screen.getByText("common.save"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("renders delete button when onDelete is provided", () => {
    render(
      <EditSubPanel title="Edit" onBack={vi.fn()} onDelete={vi.fn()}>
        <p>Content</p>
      </EditSubPanel>,
    );

    expect(screen.getByText("common.delete")).toBeInTheDocument();
  });

  it("renders custom delete label when deleteLabel is provided", () => {
    render(
      <EditSubPanel title="Edit" onBack={vi.fn()} onDelete={vi.fn()} deleteLabel="Remove event">
        <p>Content</p>
      </EditSubPanel>,
    );

    expect(screen.getByText("Remove event")).toBeInTheDocument();
  });

  it("uses two-click delete confirmation", () => {
    const onDelete = vi.fn();
    render(
      <EditSubPanel title="Edit" onBack={vi.fn()} onDelete={onDelete}>
        <p>Content</p>
      </EditSubPanel>,
    );

    // First click: should not call onDelete, should show confirmation text
    fireEvent.click(screen.getByText("common.delete"));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("common.delete?")).toBeInTheDocument();

    // Second click: should call onDelete
    fireEvent.click(screen.getByText("common.delete?"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("uses custom deleteLabel in two-click confirmation", () => {
    const onDelete = vi.fn();
    render(
      <EditSubPanel title="Edit" onBack={vi.fn()} onDelete={onDelete} deleteLabel="Remove">
        <p>Content</p>
      </EditSubPanel>,
    );

    // First click: shows "Remove"
    fireEvent.click(screen.getByText("Remove"));
    expect(onDelete).not.toHaveBeenCalled();
    // Second click confirmation: shows "Remove?"
    expect(screen.getByText("Remove?")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Remove?"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("renders both save and delete buttons together", () => {
    render(
      <EditSubPanel title="Edit" onBack={vi.fn()} onSave={vi.fn()} onDelete={vi.fn()}>
        <p>Content</p>
      </EditSubPanel>,
    );

    expect(screen.getByText("common.save")).toBeInTheDocument();
    expect(screen.getByText("common.delete")).toBeInTheDocument();
  });
});
