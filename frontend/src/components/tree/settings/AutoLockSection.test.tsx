import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const mockUpdate = vi.fn();
vi.mock("../../../hooks/useCanvasSettings", () => ({
  useCanvasSettings: () => ({
    settings: { autoLockMinutes: 15 },
    update: (...args: unknown[]) => mockUpdate(...args),
  }),
}));

import { AutoLockSection } from "./AutoLockSection";

describe("AutoLockSection", () => {
  it("renders select with current value", () => {
    render(<AutoLockSection />);
    const select = screen.getByRole("combobox", { name: "settings.autoLockTimeout" });
    expect((select as HTMLSelectElement).value).toBe("15");
  });

  it("renders all timeout options", () => {
    render(<AutoLockSection />);
    const options = screen
      .getByRole("combobox", { name: "settings.autoLockTimeout" })
      .querySelectorAll("option");
    expect(options).toHaveLength(5);
    expect(options[0].value).toBe("5");
    expect(options[1].value).toBe("15");
    expect(options[2].value).toBe("30");
    expect(options[3].value).toBe("60");
    expect(options[4].value).toBe("0");
  });

  it("calls update when timeout is changed", async () => {
    render(<AutoLockSection />);
    const select = screen.getByRole("combobox", { name: "settings.autoLockTimeout" });
    await userEvent.selectOptions(select, "30");
    expect(mockUpdate).toHaveBeenCalledWith({ autoLockMinutes: 30 });
  });

  it("calls update with 0 when auto-lock is disabled", async () => {
    render(<AutoLockSection />);
    const select = screen.getByRole("combobox", { name: "settings.autoLockTimeout" });
    await userEvent.selectOptions(select, "0");
    expect(mockUpdate).toHaveBeenCalledWith({ autoLockMinutes: 0 });
  });
});
