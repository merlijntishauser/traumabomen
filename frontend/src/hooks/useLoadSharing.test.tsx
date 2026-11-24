import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLoadSharing } from "./useLoadSharing";

const mockLoadSharing = vi.fn();
vi.mock("../lib/sharingLoader", () => ({
  loadSharing: (...args: unknown[]) => mockLoadSharing(...args),
}));

const mockSetSharing = vi.fn();
const mockStartSharingLoad = vi.fn();
vi.mock("../contexts/useEncryption", () => ({
  useEncryption: () => ({ setSharing: mockSetSharing, startSharingLoad: mockStartSharingLoad }),
}));

const masterKey = { id: "master" } as unknown as CryptoKey;

function setup() {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useLoadSharing(), { wrapper });
  return { start: result.current, invalidate };
}

describe("useLoadSharing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores the loaded sharing state and refreshes the received shares", async () => {
    const sharedKeys = new Map([["t1", { id: "k" } as unknown as CryptoKey]]);
    const sharedTrees = new Map([["t1", { shareId: "s1", treeId: "t1", ownerLabel: "Anna" }]]);
    mockLoadSharing.mockResolvedValue({ sharedKeys, sharedTrees });
    const { start, invalidate } = setup();
    const ownKeyRing = new Map([["own", "b64"]]);

    start(masterKey, ownKeyRing);

    expect(mockLoadSharing).toHaveBeenCalledWith(masterKey, ownKeyRing);
    await waitFor(() =>
      expect(mockSetSharing).toHaveBeenCalledWith(masterKey, sharedKeys, sharedTrees),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["shares", "received"] });
  });

  it("returns before the sharing state has loaded", () => {
    mockLoadSharing.mockReturnValue(new Promise(() => {}));
    const { start } = setup();

    expect(start(masterKey, new Map())).toBeUndefined();
    expect(mockStartSharingLoad).toHaveBeenCalledWith(masterKey);
    expect(mockSetSharing).not.toHaveBeenCalled();
  });
});
