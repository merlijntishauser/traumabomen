import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./ThemeToggle";

const mockToggle = vi.fn();
let currentTheme = "dark";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
  }),
}));

vi.mock("../hooks/useTheme", () => ({
  useTheme: () => ({
    theme: currentTheme,
    toggle: mockToggle,
  }),
}));

describe("ThemeToggle", () => {
  it("renders a button", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("has the correct aria-label", () => {
    render(<ThemeToggle />);
    expect(screen.getByLabelText("theme.toggle")).toBeInTheDocument();
  });

  it("applies the provided className", () => {
    render(<ThemeToggle className="custom-class" />);
    expect(screen.getByRole("button")).toHaveClass("custom-class");
  });

  it("calls toggle when clicked", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button"));
    expect(mockToggle).toHaveBeenCalledOnce();
  });

  it("renders an SVG icon", () => {
    const { container } = render(<ThemeToggle />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("renders different icons for dark and light themes", () => {
    const { container: darkContainer } = render(<ThemeToggle />);
    const darkSvg = darkContainer.querySelector("svg")!.innerHTML;

    currentTheme = "light";
    const { container: lightContainer } = render(<ThemeToggle />);
    const lightSvg = lightContainer.querySelector("svg")!.innerHTML;

    // Dark shows sun icon (circle + lines), light shows moon icon (path)
    expect(darkSvg).not.toBe(lightSvg);

    // Reset for other tests
    currentTheme = "dark";
  });
});
