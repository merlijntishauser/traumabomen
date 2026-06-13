import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDemoTreeData } from "./useDemoTreeData";

describe("useDemoTreeData", () => {
  it("loads the English fixture into a populated demo state", async () => {
    const { result } = renderHook(() => useDemoTreeData("en"));
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.treeName).toBeTruthy();
    expect(result.current?.persons.size).toBeGreaterThan(0);
    expect(result.current?.relationships.size).toBeGreaterThan(0);
  });

  it("loads the Dutch fixture for an nl language tag", async () => {
    const { result } = renderHook(() => useDemoTreeData("nl-NL"));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current?.persons.size).toBeGreaterThan(0);
  });
});
