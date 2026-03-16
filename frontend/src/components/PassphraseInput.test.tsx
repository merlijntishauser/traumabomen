import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { PassphraseInput } from "./PassphraseInput";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

describe("PassphraseInput", () => {
  it("renders a password input by default", () => {
    render(<PassphraseInput value="" onChange={() => {}} />);
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("has data-1p-ignore attribute", () => {
    render(<PassphraseInput value="" onChange={() => {}} />);
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.hasAttribute("data-1p-ignore")).toBe(true);
  });

  it("uses passphrase-specific aria labels", async () => {
    const user = userEvent.setup();
    render(<PassphraseInput value="secret" onChange={() => {}} />);

    const toggleBtn = screen.getByRole("button", { name: "common.showPassphrase" });
    expect(toggleBtn).toBeTruthy();

    await user.click(toggleBtn);
    expect(screen.getByRole("button", { name: "common.hidePassphrase" })).toBeTruthy();
  });

  it("forwards ref to the input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<PassphraseInput ref={ref} value="" onChange={() => {}} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("passes through additional props", () => {
    render(<PassphraseInput id="pp" placeholder="Enter passphrase" value="" onChange={() => {}} />);
    const input = document.querySelector("#pp") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.placeholder).toBe("Enter passphrase");
  });
});
