import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api";
import { GuestCopyError } from "../lib/guestCopy";
import { GuestCopyLoadError, GuestCopyTooLargeError } from "../lib/publishGuestCopy";
import { guestLinkErrorKey, useGuestLinks, useTreesWithGuestLinks } from "./useGuestLinks";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { language: "nl-NL" } }),
}));

const api = vi.hoisted(() => ({
  listGuestLinks: vi.fn(),
  createGuestLink: vi.fn(),
  republishGuestLink: vi.fn(),
  extendGuestLink: vi.fn(),
  unlockGuestLink: vi.fn(),
  deleteGuestLink: vi.fn(),
}));
vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  ...api,
}));

const mockPublish = vi.fn();
vi.mock("../lib/publishGuestCopy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/publishGuestCopy")>()),
  publishGuestCopy: (...a: unknown[]) => mockPublish(...a),
}));

const TREE_KEY = { tree: "key" } as unknown as CryptoKey;
const mockEncryptForApi = vi.fn();
vi.mock("../lib/crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/crypto")>()),
  decryptFromApi: async (blob: string) => JSON.parse(blob),
  encryptForApi: (...a: unknown[]) => mockEncryptForApi(...a),
}));

const mockGeneratePassphrase = vi.fn();
vi.mock("../lib/passphraseWords", () => ({
  generatePassphrase: (...a: unknown[]) => mockGeneratePassphrase(...a),
}));

let mockTreeKeys = new Map([["tree-1", TREE_KEY]]);
vi.mock("../contexts/useEncryption", () => ({
  useEncryption: () => ({ treeKeys: mockTreeKeys }),
}));

const SECRET = {
  linkSecret: "S".repeat(43),
  passphrase: "een twee drie vier vijf",
  label: "Therapeut",
};

function link(id: string, ownerBlob = JSON.stringify(SECRET)) {
  return {
    id,
    owner_blob: ownerBlob,
    created_at: "2026-11-25T10:00:00Z",
    published_at: "2026-11-25T10:00:00Z",
    expires_at: "2026-12-02T10:00:00Z",
    open_count: 0,
    last_opened_at: null,
    network_count: null,
    failed_total: 0,
    locked: false,
  };
}

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

async function setup() {
  const hook = renderHook(() => useGuestLinks("tree-1"), { wrapper });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

describe("useGuestLinks", () => {
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mockTreeKeys = new Map([["tree-1", TREE_KEY]]);
    for (const fn of Object.values(api)) fn.mockReset();
    api.listGuestLinks.mockResolvedValue([]);
    api.createGuestLink.mockResolvedValue(link("new"));
    api.republishGuestLink.mockResolvedValue(link("l1"));
    mockPublish.mockReset().mockResolvedValue({ linkId: "id", token: "tok", ciphertext: "ct" });
    mockEncryptForApi.mockReset().mockResolvedValue("owner-blob");
    mockGeneratePassphrase.mockReset().mockResolvedValue("een twee drie vier vijf");
  });

  it("reads each link's secret from its owner blob, null when it does not decrypt", async () => {
    api.listGuestLinks.mockResolvedValue([link("l1"), link("l2", "garbage")]);
    const { result } = await setup();
    expect(result.current.links.map((l) => [l.id, l.secret])).toEqual([
      ["l1", SECRET],
      ["l2", null],
    ]);
  });

  it("creates a link in the owner's language, sealing secret, passphrase and label under the tree key", async () => {
    const { result } = await setup();
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.create({ label: "Therapeut", days: 7 });
    });
    expect(outcome).toEqual({ ok: true });
    expect(mockGeneratePassphrase).toHaveBeenCalledWith("nl");
    const publishArgs = mockPublish.mock.calls[0][0];
    expect(publishArgs).toMatchObject({ treeId: "tree-1", treeKey: TREE_KEY, language: "nl" });
    expect(mockEncryptForApi).toHaveBeenCalledWith(
      {
        linkSecret: publishArgs.linkSecret,
        passphrase: "een twee drie vier vijf",
        label: "Therapeut",
      },
      TREE_KEY,
    );
    expect(api.createGuestLink).toHaveBeenCalledWith("tree-1", {
      link_id: "id",
      token: "tok",
      ciphertext: "ct",
      owner_blob: "owner-blob",
      expires_in_days: 7,
    });
    await waitFor(() => expect(api.listGuestLinks).toHaveBeenCalledTimes(2));
  });

  it("creates nothing when publishing fails", async () => {
    mockPublish.mockRejectedValue(new GuestCopyLoadError());
    const { result } = await setup();
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.create({ label: "", days: 7 });
    });
    expect(outcome).toEqual({ error: "guestLinks.errorLoad" });
    expect(api.createGuestLink).not.toHaveBeenCalled();
  });

  it("republishes with the stored secret and only on request", async () => {
    api.listGuestLinks.mockResolvedValue([link("l1")]);
    const { result } = await setup();
    expect(mockPublish).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.republish(result.current.links[0]);
    });
    expect(mockPublish.mock.calls[0][0]).toMatchObject({
      linkSecret: SECRET.linkSecret,
      passphrase: SECRET.passphrase,
    });
    expect(api.republishGuestLink).toHaveBeenCalledWith("tree-1", "l1", "ct");
  });

  it("refuses to publish without the tree key", async () => {
    mockTreeKeys = new Map();
    const { result } = await setup();
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.create({ label: "", days: 7 });
    });
    expect(outcome).toEqual({ error: "guestLinks.errorGeneric" });
    expect(mockPublish).not.toHaveBeenCalled();
  });
});

describe("guestLinkErrorKey", () => {
  it.each([
    ["too large locally", new GuestCopyTooLargeError(), "guestLinks.errorTooLarge"],
    [
      "413 from the API or nginx",
      new ApiError(413, "Request Entity Too Large"),
      "guestLinks.errorTooLarge",
    ],
    ["load failure", new GuestCopyLoadError(), "guestLinks.errorLoad"],
    ["invalid copy", new GuestCopyError(), "guestLinks.errorInvalid"],
    ["flag off", new ApiError(403, "guest_links_not_enabled"), "guestLinks.errorDisabled"],
    ["link cap", new ApiError(409, "too_many_links"), "guestLinks.errorTooMany"],
    ["rate limit", new ApiError(429, "Too many requests"), "guestLinks.errorRateLimited"],
    ["other API error", new ApiError(500, "boom"), "guestLinks.errorGeneric"],
    ["anything else", new Error("network"), "guestLinks.errorGeneric"],
  ])("maps %s", (_name, err, key) => {
    expect(guestLinkErrorKey(err)).toBe(key);
  });
});

describe("useTreesWithGuestLinks", () => {
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    api.listGuestLinks.mockReset();
  });

  it("names the trees that have links", async () => {
    api.listGuestLinks.mockImplementation(async (id: string) => (id === "t2" ? [link("l1")] : []));
    const { result } = renderHook(() => useTreesWithGuestLinks(["t1", "t2"], true), { wrapper });
    await waitFor(() => expect(result.current.has("t2")).toBe(true));
    expect(result.current.has("t1")).toBe(false);
  });

  it("asks nothing when disabled", () => {
    const { result } = renderHook(() => useTreesWithGuestLinks(["t1"], false), { wrapper });
    expect(result.current.size).toBe(0);
    expect(api.listGuestLinks).not.toHaveBeenCalled();
  });
});
