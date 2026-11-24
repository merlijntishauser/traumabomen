import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DisplayNameSection } from "./DisplayNameSection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));

const mockGetProfile = vi.fn();
const mockUpdateProfile = vi.fn();
vi.mock("../../../lib/api", () => ({
  getProfile: (...a: unknown[]) => mockGetProfile(...a),
  updateProfile: (...a: unknown[]) => mockUpdateProfile(...a),
}));

describe("DisplayNameSection", () => {
  beforeEach(() => {
    mockGetProfile.mockReset().mockResolvedValue({ display_name: "Anna" });
    mockUpdateProfile.mockReset().mockResolvedValue({ display_name: null });
  });

  it("says the name is shown to others and stored without encryption", async () => {
    render(<DisplayNameSection />);
    expect(await screen.findByText("account.displayNameHelp")).toBeInTheDocument();
  });

  it("saves and clears the display name", async () => {
    render(<DisplayNameSection />);
    const input = await screen.findByDisplayValue("Anna");
    const save = screen.getByRole("button", { name: "common.save" });
    expect(save).toBeDisabled();

    fireEvent.change(input, { target: { value: "  Annie " } });
    fireEvent.click(save);
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenLastCalledWith("Annie"));
    expect(await screen.findByText("account.displayNameSaved")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    await waitFor(() => expect(mockUpdateProfile).toHaveBeenLastCalledWith(null));
  });

  it("shows an error when saving fails", async () => {
    mockUpdateProfile.mockRejectedValue(new Error("network"));
    render(<DisplayNameSection />);
    fireEvent.change(await screen.findByDisplayValue("Anna"), { target: { value: "B" } });
    fireEvent.click(screen.getByRole("button", { name: "common.save" }));
    expect(await screen.findByText("account.displayNameError")).toBeInTheDocument();
  });
});
