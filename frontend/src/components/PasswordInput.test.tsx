import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { PasswordInput } from "./PasswordInput";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string) => k,
    i18n: { language: "en" },
  }),
}));

describe("PasswordInput", () => {
  it("renders a password input by default", () => {
    render(<PasswordInput value="" onChange={() => {}} />);
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("toggles to text input when eye button is clicked", async () => {
    const user = userEvent.setup();
    render(<PasswordInput value="secret" onChange={() => {}} />);

    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("password");

    const toggleBtn = screen.getByRole("button", { name: "common.showPassword" });
    await user.click(toggleBtn);

    expect(input.type).toBe("text");
  });

  it("toggles back to password when clicked again", async () => {
    const user = userEvent.setup();
    render(<PasswordInput value="secret" onChange={() => {}} />);

    const toggleBtn = screen.getByRole("button", { name: "common.showPassword" });
    await user.click(toggleBtn);

    const hideBtn = screen.getByRole("button", { name: "common.hidePassword" });
    await user.click(hideBtn);

    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.type).toBe("password");
  });

  it("forwards ref to the input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<PasswordInput ref={ref} value="" onChange={() => {}} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current?.tagName).toBe("INPUT");
  });

  it("passes through className to the input", () => {
    render(<PasswordInput className="custom-class" value="" onChange={() => {}} />);
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.classList.contains("custom-class")).toBe(true);
  });

  it("passes through id and placeholder", () => {
    render(
      <PasswordInput id="test-pw" placeholder="Enter password" value="" onChange={() => {}} />,
    );
    const input = document.querySelector("#test-pw") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.placeholder).toBe("Enter password");
  });

  it("toggle button has type=button to prevent form submission", () => {
    render(<PasswordInput value="" onChange={() => {}} />);
    const toggleBtn = screen.getByRole("button", { name: "common.showPassword" });
    expect(toggleBtn.getAttribute("type")).toBe("button");
  });

  it("calls onChange when typing", async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    render(<PasswordInput value="" onChange={handleChange} />);

    const input = document.querySelector("input") as HTMLInputElement;
    await user.type(input, "a");
    expect(handleChange).toHaveBeenCalled();
  });

  it("adds paddingRight to prevent text overlapping toggle", () => {
    render(<PasswordInput value="" onChange={() => {}} />);
    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.style.paddingRight).toBe("36px");
  });

  it("toggle button has tabIndex -1 to stay out of tab order", () => {
    render(<PasswordInput value="" onChange={() => {}} />);
    const toggleBtn = screen.getByRole("button", { name: "common.showPassword" });
    expect(toggleBtn.tabIndex).toBe(-1);
  });
});
