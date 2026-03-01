import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en" },
  }),
}));

describe("PasswordStrengthMeter", () => {
  it("renders nothing when password is empty", () => {
    const { container } = render(<PasswordStrengthMeter password="" />);
    expect(container.firstChild).toBeNull();
  });

  it("shows weak label for a weak password", () => {
    render(<PasswordStrengthMeter password="abc" />);
    expect(screen.getByText("password.weak")).toBeInTheDocument();
  });

  it("shows weak label for 8 chars single case", () => {
    render(<PasswordStrengthMeter password="abcdefgh" />);
    expect(screen.getByText("password.weak")).toBeInTheDocument();
  });

  it("shows fair label for a fair password", () => {
    render(<PasswordStrengthMeter password="Abcdefg1" />);
    expect(screen.getByText("password.fair")).toBeInTheDocument();
  });

  it("shows strong label for a strong password", () => {
    render(<PasswordStrengthMeter password="Abcdefghijklmno1" />);
    expect(screen.getByText("password.strong")).toBeInTheDocument();
  });

  it("renders three meter segments", () => {
    const { container } = render(<PasswordStrengthMeter password="abc" />);
    const segments = container.querySelectorAll(".password-meter__segment");
    expect(segments).toHaveLength(3);
  });

  it("applies the correct level class to the meter", () => {
    const { container } = render(<PasswordStrengthMeter password="Abcdefghijklmno1" />);
    const meter = container.querySelector(".password-meter");
    expect(meter?.classList.contains("password-meter--strong")).toBe(true);
  });
});
