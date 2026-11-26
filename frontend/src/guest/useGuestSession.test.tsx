import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import demoFixtureEn from "../fixtures/demo-tree-en.json";
import argon2 from "../lib/argon2";
import { buildDemoState } from "../lib/buildDemoState";
import type { DemoFixture } from "../lib/createDemoTree";
import { buildGuestCopy } from "../lib/guestCopy";
import { deriveGuestKeys, encryptGuestCopy, generateLinkSecret } from "../lib/guestCrypto";
import type { GuestOpenResult } from "./guestApi";
import { openGuestLink } from "./guestApi";
import { GUEST_IDLE_MS, useGuestSession } from "./useGuestSession";

const changeLanguage = vi.fn();
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ i18n: { changeLanguage } }),
}));

vi.mock("./guestApi", () => ({ openGuestLink: vi.fn() }));

// The real Argon2id (64 MiB) is pinned by the fixed vectors in guestCrypto's
// unit tests; here a fast stand-in keeps the rest of the derivation and the
// AES-GCM encryption real.
vi.mock("../lib/argon2", () => ({
  default: {
    ArgonType: { Argon2d: 0, Argon2i: 1, Argon2id: 2 },
    async hash({ pass, salt }: { pass: string; salt: Uint8Array }) {
      const input = new TextEncoder().encode(pass);
      const joined = new Uint8Array(input.length + salt.length);
      joined.set(input);
      joined.set(salt, input.length);
      return { hash: new Uint8Array(await crypto.subtle.digest("SHA-256", joined)) };
    },
  },
}));

const PASSPHRASE = "anchor ladle meadow pebble violin";
const NOW = new Date("2026-11-20T10:00:00.000Z");
const mockOpen = vi.mocked(openGuestLink);

let secret: string;
let linkId: string;
let token: string;
let ciphertext: string;

function demoCopy() {
  return JSON.parse(
    JSON.stringify(buildGuestCopy(buildDemoState(demoFixtureEn as DemoFixture), NOW, "nl")),
  );
}

beforeAll(async () => {
  secret = generateLinkSecret();
  const keys = await deriveGuestKeys(secret, PASSPHRASE);
  linkId = keys.linkId;
  token = keys.token;
  ciphertext = await encryptGuestCopy(JSON.stringify(demoCopy()), keys.encKey, linkId);
});

/** The server: the right token gets the given copy, any other one is a wrong passphrase. */
function serve(blob: string) {
  mockOpen.mockImplementation(async (id, tok): Promise<GuestOpenResult> => {
    if (id === linkId && tok === token) return { kind: "ok", ciphertext: blob };
    return { kind: "wrong_passphrase" };
  });
}

function visit(fragment: string) {
  window.history.replaceState(null, "", `/view${fragment}`);
  return renderHook(() => useGuestSession());
}

let setItem: ReturnType<typeof vi.spyOn>;
let cookieSetter: ReturnType<typeof vi.spyOn>;
const idbOpen = vi.fn();

beforeEach(() => {
  mockOpen.mockReset();
  changeLanguage.mockReset();
  serve(ciphertext);
  setItem = vi.spyOn(Storage.prototype, "setItem");
  cookieSetter = vi.spyOn(Document.prototype, "cookie", "set");
  vi.stubGlobal("indexedDB", { open: idbOpen });
});

afterEach(() => {
  // Nothing the guest page does may write any storage.
  expect(setItem).not.toHaveBeenCalled();
  expect(cookieSetter).not.toHaveBeenCalled();
  expect(idbOpen).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useGuestSession: the link", () => {
  it("clears the fragment from the address bar before any request", async () => {
    let urlAtRequest = "";
    mockOpen.mockImplementation(async () => {
      urlAtRequest = window.location.href;
      return { kind: "not_available" };
    });
    const { result } = visit(`#${secret}`);
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/view");
    expect(result.current.state).toEqual({ kind: "ready" });

    await act(() => result.current.open(PASSPHRASE));
    expect(urlAtRequest).not.toContain(secret);
    expect(urlAtRequest.endsWith("/view")).toBe(true);
  });

  it("is no_link without a fragment", () => {
    const { result } = visit("");
    expect(result.current.state).toEqual({ kind: "no_link" });
  });

  it("opens a link with a trailing parenthesis from a mail client", async () => {
    const { result } = visit(`#${secret})`);
    await act(() => result.current.open(PASSPHRASE));
    expect(result.current.state.kind).toBe("open");
  });

  it("is malformed_link for a truncated fragment and never makes a request", async () => {
    const { result } = visit(`#${secret.slice(0, 30)}`);
    expect(result.current.state).toEqual({ kind: "malformed_link" });
    await act(() => result.current.open(PASSPHRASE));
    expect(result.current.state).toEqual({ kind: "malformed_link" });
    expect(mockOpen).not.toHaveBeenCalled();
  });
});

describe("useGuestSession: opening", () => {
  it("opens the copy, applies its language and keeps its publish date", async () => {
    const { result } = visit(`#${secret}`);
    await act(() => result.current.open(PASSPHRASE));
    const state = result.current.state;
    if (state.kind !== "open") throw new Error(`expected open, got ${state.kind}`);
    expect(state.publishedAt).toBe(NOW.toISOString());
    expect(state.tree.persons.size).toBe(demoCopy().persons.length);
    expect(changeLanguage).toHaveBeenCalledWith("nl");
    expect(mockOpen).toHaveBeenCalledWith(linkId, token);
  });

  it("accepts the passphrase in another case and spacing", async () => {
    const { result } = visit(`#${secret}`);
    await act(() => result.current.open("  Anchor-ladle  MEADOW pebble violin "));
    expect(result.current.state.kind).toBe("open");
  });

  it("is opening while the request is in flight", async () => {
    let respond: (value: GuestOpenResult) => void = () => {};
    mockOpen.mockImplementation(
      () =>
        new Promise((resolve) => {
          respond = resolve;
        }),
    );
    const { result } = visit(`#${secret}`);
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.open(PASSPHRASE);
    });
    expect(result.current.state).toEqual({ kind: "opening" });
    await waitFor(() => expect(mockOpen).toHaveBeenCalled());
    await act(async () => {
      respond({ kind: "not_available" });
      await pending;
    });
    expect(result.current.state).toEqual({ kind: "not_available" });
  });

  it("is wrong_passphrase for another passphrase and lets the guest try again", async () => {
    const { result } = visit(`#${secret}`);
    await act(() => result.current.open("anchor ladle meadow pebble viola"));
    expect(result.current.state).toEqual({ kind: "wrong_passphrase" });
    await act(() => result.current.open(PASSPHRASE));
    expect(result.current.state.kind).toBe("open");
  });

  it.each(["locked", "not_available", "rate_limited", "offline"] as const)(
    "is %s when the server says so",
    async (kind) => {
      mockOpen.mockResolvedValue({ kind });
      const { result } = visit(`#${secret}`);
      await act(() => result.current.open(PASSPHRASE));
      expect(result.current.state).toEqual({ kind });
    },
  );

  it("is ready with an error for an unexpected response", async () => {
    mockOpen.mockResolvedValue({ kind: "error" });
    const { result } = visit(`#${secret}`);
    await act(() => result.current.open(PASSPHRASE));
    expect(result.current.state).toEqual({ kind: "ready", error: true });
  });

  it("is ready with an error when the key cannot be derived, and makes no request", async () => {
    // As when the argon2 script has not loaded: lib/argon2 throws, guestCrypto
    // turns that into a KeyDerivationError.
    vi.spyOn(argon2, "hash").mockRejectedValueOnce(new Error("argon2-browser not loaded yet"));
    const { result } = visit(`#${secret}`);
    await act(() => result.current.open(PASSPHRASE));
    expect(result.current.state).toEqual({ kind: "ready", error: true });
    expect(mockOpen).not.toHaveBeenCalled();

    await act(() => result.current.open(PASSPHRASE));
    expect(result.current.state.kind).toBe("open");
  });

  it("drops the link after a final answer", async () => {
    mockOpen.mockResolvedValue({ kind: "locked" });
    const { result } = visit(`#${secret}`);
    await act(() => result.current.open(PASSPHRASE));
    await act(() => result.current.open(PASSPHRASE));
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });
});

describe("useGuestSession: an untrusted copy", () => {
  async function encrypted(json: string) {
    const keys = await deriveGuestKeys(secret, PASSPHRASE);
    return encryptGuestCopy(json, keys.encKey, keys.linkId);
  }

  it("is undecryptable for a hostile copy (a colour outside the palette)", async () => {
    const copy = demoCopy();
    copy.patterns[0].color = "url(https://example.com/x)";
    serve(await encrypted(JSON.stringify(copy)));
    const { result } = visit(`#${secret}`);
    await act(() => result.current.open(PASSPHRASE));
    expect(result.current.state).toEqual({ kind: "undecryptable" });
    expect(changeLanguage).not.toHaveBeenCalled();
  });

  it("is undecryptable for a copy that is not JSON", async () => {
    serve(await encrypted("not json"));
    const { result } = visit(`#${secret}`);
    await act(() => result.current.open(PASSPHRASE));
    expect(result.current.state).toEqual({ kind: "undecryptable" });
  });

  it("is undecryptable for a tampered ciphertext", async () => {
    const blob = JSON.parse(ciphertext) as { iv: string; ciphertext: string };
    const bytes = Uint8Array.from(atob(blob.ciphertext), (c) => c.charCodeAt(0));
    bytes[0] ^= 1;
    serve(JSON.stringify({ iv: blob.iv, ciphertext: btoa(String.fromCharCode(...bytes)) }));
    const { result } = visit(`#${secret}`);
    await act(() => result.current.open(PASSPHRASE));
    expect(result.current.state).toEqual({ kind: "undecryptable" });
  });
});

describe("useGuestSession: dropping the session", () => {
  it("ends the open view on pagehide and forgets the link", async () => {
    const { result } = visit(`#${secret}`);
    await act(() => result.current.open(PASSPHRASE));
    expect(result.current.state.kind).toBe("open");

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(result.current.state).toEqual({ kind: "ended_idle" });
    await act(() => result.current.open(PASSPHRASE));
    expect(result.current.state).toEqual({ kind: "ended_idle" });
    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it("ends the open view after 15 idle minutes, counting activity", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { result } = visit(`#${secret}`);
    await act(() => result.current.open(PASSPHRASE));
    expect(result.current.state.kind).toBe("open");

    act(() => {
      vi.advanceTimersByTime(GUEST_IDLE_MS - 60_000);
      window.dispatchEvent(new Event("keydown"));
      vi.advanceTimersByTime(GUEST_IDLE_MS - 60_000);
      document.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(GUEST_IDLE_MS - 60_000);
    });
    expect(result.current.state.kind).toBe("open");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.state).toEqual({ kind: "ended_idle" });
  });

  it("ends an idle passphrase screen too", () => {
    vi.useFakeTimers();
    const { result } = visit(`#${secret}`);
    act(() => {
      vi.advanceTimersByTime(GUEST_IDLE_MS);
    });
    expect(result.current.state).toEqual({ kind: "ended_idle" });
  });

  it("discards an open still in flight when the session ends", async () => {
    let respond: (value: GuestOpenResult) => void = () => {};
    mockOpen.mockImplementation(
      () =>
        new Promise((resolve) => {
          respond = resolve;
        }),
    );
    const { result } = visit(`#${secret}`);
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.open(PASSPHRASE);
    });
    await waitFor(() => expect(mockOpen).toHaveBeenCalled());
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    await act(async () => {
      respond({ kind: "ok", ciphertext });
      await pending;
    });
    expect(result.current.state).toEqual({ kind: "ended_idle" });
    expect(changeLanguage).not.toHaveBeenCalled();
  });
});
