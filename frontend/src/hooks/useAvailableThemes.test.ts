import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAvailableThemes } from "./useAvailableThemes";

describe("useAvailableThemes", () => {
  it("returns dark and light themes", () => {
    const { result } = renderHook(() => useAvailableThemes());
    expect(result.current).toEqual(["dark", "light"]);
  });
});
