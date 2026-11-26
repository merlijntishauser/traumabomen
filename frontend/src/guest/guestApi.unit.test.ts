import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openGuestLink } from "./guestApi";

const mockFetch = vi.fn();

function res(status: number, body: unknown = {}) {
  return { status, ok: status < 300, json: () => Promise.resolve(body) };
}

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("openGuestLink", () => {
  it("posts the id and token with private request options", async () => {
    mockFetch.mockResolvedValueOnce(res(200, { ciphertext: "abc" }));
    const result = await openGuestLink("id1", "tok1");
    expect(result).toEqual({ kind: "ok", ciphertext: "abc" });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/guest/open");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ link_id: "id1", token: "tok1" });
    expect(init.credentials).toBe("omit");
    expect(init.cache).toBe("no-store");
    expect(init.referrerPolicy).toBe("no-referrer");
    expect(init.headers.Authorization).toBeUndefined();
  });

  it.each([
    [404, "not_available"],
    [423, "locked"],
    [401, "wrong_passphrase"],
    [429, "rate_limited"],
    [500, "error"],
    [403, "error"],
  ])("maps status %i to %s", async (status, kind) => {
    mockFetch.mockResolvedValueOnce(res(status));
    expect(await openGuestLink("id", "t")).toEqual({ kind });
  });

  it("maps a network failure to offline", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("failed"));
    expect(await openGuestLink("id", "t")).toEqual({ kind: "offline" });
  });

  it("treats a 200 without a ciphertext as an error", async () => {
    mockFetch.mockResolvedValueOnce(res(200, {}));
    expect(await openGuestLink("id", "t")).toEqual({ kind: "error" });
  });
});
