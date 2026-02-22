import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReflectionNudge } from "./ReflectionNudge";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../lib/reflectionPrompts", () => ({
  getNudgePrompt: () => "Test nudge prompt",
}));

describe("ReflectionNudge", () => {
  it("renders the prompt text", () => {
    render(<ReflectionNudge onOpenJournal={vi.fn()} />);
    expect(screen.getByText("Test nudge prompt")).toBeInTheDocument();
  });

  it("renders the write-about button", () => {
    render(<ReflectionNudge onOpenJournal={vi.fn()} />);
    expect(screen.getByText("prompt.nudge.writeAbout")).toBeInTheDocument();
  });

  it("renders the dismiss button", () => {
    render(<ReflectionNudge onOpenJournal={vi.fn()} />);
    expect(screen.getByLabelText("prompt.nudge.dismiss")).toBeInTheDocument();
  });

  it("calls onOpenJournal with prompt text when write-about is clicked", async () => {
    const user = userEvent.setup();
    const onOpenJournal = vi.fn();
    render(<ReflectionNudge onOpenJournal={onOpenJournal} />);

    await user.click(screen.getByText("prompt.nudge.writeAbout"));
    expect(onOpenJournal).toHaveBeenCalledWith("Test nudge prompt");
  });

  it("hides the nudge when dismiss is clicked", async () => {
    const user = userEvent.setup();
    render(<ReflectionNudge onOpenJournal={vi.fn()} />);

    expect(screen.getByTestId("reflection-nudge")).toBeInTheDocument();
    await user.click(screen.getByLabelText("prompt.nudge.dismiss"));
    expect(screen.queryByTestId("reflection-nudge")).not.toBeInTheDocument();
  });

  it("does not call onOpenJournal when dismiss is clicked", async () => {
    const user = userEvent.setup();
    const onOpenJournal = vi.fn();
    render(<ReflectionNudge onOpenJournal={onOpenJournal} />);

    await user.click(screen.getByLabelText("prompt.nudge.dismiss"));
    expect(onOpenJournal).not.toHaveBeenCalled();
  });
});
