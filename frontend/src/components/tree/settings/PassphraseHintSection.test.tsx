import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PassphraseHintSection } from "./PassphraseHintSection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

const mockUpdateHint = vi.fn().mockResolvedValue(undefined);
vi.mock("../../../lib/api", () => ({
  updatePassphraseHint: (...args: unknown[]) => mockUpdateHint(...args),
  getEncryptionSalt: vi.fn().mockResolvedValue({
    encryption_salt: "salt",
    passphrase_hint: "Old hint", // eslint-disable-line sonarjs/no-hardcoded-passwords -- test fixture
  }),
}));

describe("PassphraseHintSection", () => {
  it("shows current hint after loading", async () => {
    render(<PassphraseHintSection />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Old hint")).toBeInTheDocument();
    });
  });

  it("saves updated hint", async () => {
    render(<PassphraseHintSection />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Old hint")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByDisplayValue("Old hint"), {
      target: { value: "New hint" },
    });
    fireEvent.click(screen.getByText("common.save"));
    await waitFor(() => {
      expect(mockUpdateHint).toHaveBeenCalledWith("New hint");
    });
  });

  it("clears hint when saved empty", async () => {
    render(<PassphraseHintSection />);
    await waitFor(() => {
      expect(screen.getByDisplayValue("Old hint")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByDisplayValue("Old hint"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("common.save"));
    await waitFor(() => {
      expect(mockUpdateHint).toHaveBeenCalledWith(null);
    });
  });
});
