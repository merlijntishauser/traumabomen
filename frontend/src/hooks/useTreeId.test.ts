import { renderHook } from "@testing-library/react";
import { useParams } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { uuidToCompact } from "../lib/compactId";
import { useTreeId } from "./useTreeId";

vi.mock("react-router-dom", () => ({
  useParams: vi.fn(),
}));

describe("useTreeId", () => {
  it("returns undefined when no param is present", () => {
    vi.mocked(useParams).mockReturnValue({});
    const { result } = renderHook(() => useTreeId());
    expect(result.current).toBeUndefined();
  });

  it("returns a UUID directly when id is already a UUID", () => {
    const uuid = "03f28958-029f-4663-82e3-4de766986d28";
    vi.mocked(useParams).mockReturnValue({ id: uuid });
    const { result } = renderHook(() => useTreeId());
    expect(result.current).toBe(uuid);
  });

  it("converts a compact ID back to UUID", () => {
    const uuid = "03f28958-029f-4663-82e3-4de766986d28";
    const compact = uuidToCompact(uuid);
    vi.mocked(useParams).mockReturnValue({ id: compact });
    const { result } = renderHook(() => useTreeId());
    expect(result.current).toBe(uuid);
  });

  it("returns undefined for an invalid id", () => {
    vi.mocked(useParams).mockReturnValue({ id: "!!!invalid!!!" });
    const { result } = renderHook(() => useTreeId());
    expect(result.current).toBeUndefined();
  });
});
