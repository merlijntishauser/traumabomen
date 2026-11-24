import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api";
import { useTreeShares } from "./useTreeShares";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "nl" } }),
}));

const mockGetShares = vi.fn();
const mockCreateShare = vi.fn();
const mockDeleteShare = vi.fn();
const mockGetPublicKey = vi.fn();
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  getShares: (...a: unknown[]) => mockGetShares(...a),
  createShare: (...a: unknown[]) => mockCreateShare(...a),
  deleteShare: (...a: unknown[]) => mockDeleteShare(...a),
  getPublicKey: (...a: unknown[]) => mockGetPublicKey(...a),
}));

vi.mock("../lib/crypto", () => ({
  importSharePublicKey: vi.fn().mockResolvedValue("their-key"),
  wrapTreeKey: vi.fn().mockResolvedValue("wrapped"),
}));

let mockKeyRing = new Map([["tree-1", "own-key"]]);
vi.mock("../contexts/useEncryption", () => ({
  useEncryption: () => ({ keyRingBase64: mockKeyRing }),
}));

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function setup() {
  const hook = renderHook(() => useTreeShares("tree-1"), { wrapper });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

describe("useTreeShares", () => {
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockKeyRing = new Map([["tree-1", "own-key"]]);
    mockGetShares.mockReset().mockResolvedValue([]);
    mockCreateShare.mockReset().mockResolvedValue({});
    mockDeleteShare.mockReset().mockResolvedValue(undefined);
    mockGetPublicKey.mockReset().mockResolvedValue({ public_key: "jwk" });
  });

  it.each([
    ["429 rate limit", new ApiError(429, "Too many requests"), "share.errorRateLimited"],
    ["sharing_not_enabled", new ApiError(403, "sharing_not_enabled"), "share.errorDisabled"],
    ["unknown detail", new ApiError(500, "boom"), "share.errorGeneric"],
    ["non-ApiError", new Error("network"), "share.errorGeneric"],
  ])("maps a createShare failure (%s) to its copy key", async (_n, err, key) => {
    mockCreateShare.mockRejectedValue(err);
    const { result } = await setup();
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.share("a@example.com");
    });
    expect(outcome).toEqual({ error: key });
  });

  it("reports a missing own tree key as a generic error without creating a share", async () => {
    mockKeyRing = new Map();
    const { result } = await setup();
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.share("a@example.com");
    });
    expect(outcome).toEqual({ error: "share.errorGeneric" });
    expect(mockCreateShare).not.toHaveBeenCalled();
  });

  it("maps a non-404 getPublicKey failure to an error, not an invite", async () => {
    mockGetPublicKey.mockRejectedValue(new ApiError(403, "sharing_not_enabled"));
    const { result } = await setup();
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.share("a@example.com");
    });
    expect(outcome).toEqual({ error: "share.errorDisabled" });
    expect(mockCreateShare).not.toHaveBeenCalled();
  });

  it("refetches the share list after a share and after a remove", async () => {
    const { result } = await setup();
    expect(mockGetShares).toHaveBeenCalledTimes(1);

    await act(async () => {
      expect(await result.current.share("a@example.com")).toEqual({ ok: true });
    });
    await waitFor(() => expect(mockGetShares).toHaveBeenCalledTimes(2));

    await act(async () => {
      expect(await result.current.remove("s1")).toEqual({ ok: true });
    });
    expect(mockDeleteShare).toHaveBeenCalledWith("tree-1", "s1");
    await waitFor(() => expect(mockGetShares).toHaveBeenCalledTimes(3));
  });

  it("returns an error and does not refetch when remove fails", async () => {
    mockDeleteShare.mockRejectedValue(new ApiError(500, "boom"));
    const { result } = await setup();
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.remove("s1");
    });
    expect(outcome).toEqual({ error: "share.errorGeneric" });
    expect(mockGetShares).toHaveBeenCalledTimes(1);
  });
});
