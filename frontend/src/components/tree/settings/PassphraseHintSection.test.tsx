import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PassphraseHintSection } from "./PassphraseHintSection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

const mockUpdateHint = vi.fn();
const mockGetEncryptionSalt = vi.fn();
vi.mock("../../../lib/api", () => ({
  updatePassphraseHint: (...args: unknown[]) => mockUpdateHint(...args),
  getEncryptionSalt: (...args: unknown[]) => mockGetEncryptionSalt(...args),
}));

describe("PassphraseHintSection", () => {
  beforeEach(() => {
    mockUpdateHint.mockReset().mockResolvedValue(undefined);
    mockGetEncryptionSalt.mockReset().mockResolvedValue({
      encryption_salt: "salt",
      passphrase_hint: "Old hint",
    });
  });

  it("renders nothing while loading", () => {
    mockGetEncryptionSalt.mockReturnValue(new Promise(() => {}));
    const { container } = render(<PassphraseHintSection />);
    expect(container.querySelector(".settings-panel__section")).toBeNull();
  });

  it("shows current hint after loading", async () => {
    render(<PassphraseHintSection />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Old hint")).toBeInTheDocument();
    });
  });

  it("renders empty input when API returns no hint", async () => {
    mockGetEncryptionSalt.mockResolvedValueOnce({
      encryption_salt: "salt",
      passphrase_hint: null,
    });
    render(<PassphraseHintSection />);
    const input = await screen.findByPlaceholderText("auth.hintPlaceholder");
    expect(input).toHaveValue("");
  });

  it("still renders the form when the salt API call fails", async () => {
    mockGetEncryptionSalt.mockRejectedValueOnce(new Error("network"));
    render(<PassphraseHintSection />);
    // On LOAD_FAILED the component exits loading state with an empty hint, so
    // the form is visible and editable even if the user had one on record.
    const input = await screen.findByPlaceholderText("auth.hintPlaceholder");
    expect(input).toHaveValue("");
  });

  it("disables save while the hint equals the last saved value", async () => {
    render(<PassphraseHintSection />);
    await screen.findByDisplayValue("Old hint");
    expect(screen.getByText("common.save")).toBeDisabled();
  });

  it("enables save once the hint is edited", async () => {
    render(<PassphraseHintSection />);
    const input = await screen.findByDisplayValue("Old hint");
    fireEvent.change(input, { target: { value: "Updated" } });
    expect(screen.getByText("common.save")).toBeEnabled();
  });

  it("saves updated hint and shows the success message", async () => {
    render(<PassphraseHintSection />);
    const input = await screen.findByDisplayValue("Old hint");
    fireEvent.change(input, { target: { value: "New hint" } });
    fireEvent.click(screen.getByText("common.save"));
    await waitFor(() => {
      expect(mockUpdateHint).toHaveBeenCalledWith("New hint");
    });
    expect(await screen.findByText("settings.hintSaved")).toBeInTheDocument();
  });

  it("clears hint (sends null) when saved empty", async () => {
    render(<PassphraseHintSection />);
    const input = await screen.findByDisplayValue("Old hint");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByText("common.save"));
    await waitFor(() => {
      expect(mockUpdateHint).toHaveBeenCalledWith(null);
    });
  });

  it("trims whitespace-only input to null when saving", async () => {
    render(<PassphraseHintSection />);
    const input = await screen.findByDisplayValue("Old hint");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByText("common.save"));
    await waitFor(() => {
      expect(mockUpdateHint).toHaveBeenCalledWith(null);
    });
  });

  it("shows an error message and re-enables the form when the save API fails", async () => {
    mockUpdateHint.mockRejectedValueOnce(new Error("boom"));
    render(<PassphraseHintSection />);
    const input = await screen.findByDisplayValue("Old hint");
    fireEvent.change(input, { target: { value: "New" } });
    fireEvent.click(screen.getByText("common.save"));
    expect(await screen.findByText("settings.hintError")).toBeInTheDocument();
    // No success banner, and save button re-enabled after SAVE_END.
    expect(screen.queryByText("settings.hintSaved")).not.toBeInTheDocument();
    expect(screen.getByText("common.save")).toBeEnabled();
  });

  it("disables save and shows the saving label during an in-flight request", async () => {
    let resolveSave: () => void = () => undefined;
    mockUpdateHint.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveSave = resolve;
      }),
    );
    render(<PassphraseHintSection />);
    const input = await screen.findByDisplayValue("Old hint");
    fireEvent.change(input, { target: { value: "Pending" } });
    fireEvent.click(screen.getByText("common.save"));
    expect(await screen.findByText("common.saving")).toBeInTheDocument();
    expect(screen.getByText("common.saving")).toBeDisabled();
    resolveSave();
    await waitFor(() => {
      expect(screen.getByText("common.save")).toBeInTheDocument();
    });
  });
});
