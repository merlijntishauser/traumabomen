import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  approveWaitlistEntry,
  changePassword,
  clearTokens,
  createClassification,
  createEvent,
  createLifeEvent,
  createPattern,
  createPerson,
  createRelationship,
  createTree,
  deleteAccount,
  deleteClassification,
  deleteEvent,
  deleteFeedback,
  deleteLifeEvent,
  deletePattern,
  deletePerson,
  deleteRelationship,
  deleteTree,
  deleteWaitlistEntry,
  getAccessToken,
  getAdminActivity,
  getAdminFeedback,
  getAdminFunnel,
  getAdminGrowth,
  getAdminOverview,
  getAdminRetention,
  getAdminUsage,
  getAdminUsers,
  getAdminWaitlist,
  getAdminWaitlistCapacity,
  getClassification,
  getClassifications,
  getEncryptionSalt,
  getEvent,
  getEvents,
  getIsAdmin,
  getLifeEvent,
  getLifeEvents,
  getPattern,
  getPatterns,
  getPerson,
  getPersons,
  getRefreshToken,
  getRelationship,
  getRelationships,
  getTree,
  getTrees,
  joinWaitlist,
  login,
  logout,
  markFeedbackRead,
  register,
  resendVerification,
  setTokens,
  submitFeedback,
  syncTree,
  updateClassification,
  updateEvent,
  updateLifeEvent,
  updatePattern,
  updatePerson,
  updateRelationship,
  updateSalt,
  updateTree,
  verifyEmail,
} from "./api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Dummy credentials for testing (not real passwords)
const DUMMY_PASS = "pass";
const DUMMY_OLD_PASS = "old";
const DUMMY_NEW_PASS = "new";
const DUMMY_ACCOUNT_PASS = "my-password";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Provide a simple in-memory localStorage mock for the test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

function mockResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? "OK" : "Error",
    json: () => Promise.resolve(body),
  };
}

function mockNoContentResponse() {
  return {
    ok: true,
    status: 204,
    statusText: "No Content",
    json: () => Promise.reject(new Error("No body")),
  };
}

/** Build a minimal JWT-shaped token whose payload is `payload`. */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

describe("token management", () => {
  it("setTokens stores access and refresh tokens in localStorage", () => {
    setTokens("access-abc", "refresh-xyz");
    expect(localStorage.getItem("traumabomen_access_token")).toBe("access-abc");
    expect(localStorage.getItem("traumabomen_refresh_token")).toBe("refresh-xyz");
  });

  it("getAccessToken reads from localStorage", () => {
    localStorage.setItem("traumabomen_access_token", "my-access");
    expect(getAccessToken()).toBe("my-access");
  });

  it("getRefreshToken reads from localStorage", () => {
    localStorage.setItem("traumabomen_refresh_token", "my-refresh");
    expect(getRefreshToken()).toBe("my-refresh");
  });

  it("clearTokens removes both tokens from localStorage", () => {
    setTokens("a", "b");
    clearTokens();
    expect(localStorage.getItem("traumabomen_access_token")).toBeNull();
    expect(localStorage.getItem("traumabomen_refresh_token")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------

describe("ApiError", () => {
  it("constructor sets status, detail, and name", () => {
    const err = new ApiError(422, "Validation failed");
    expect(err.status).toBe(422);
    expect(err.detail).toBe("Validation failed");
    expect(err.message).toBe("Validation failed");
    expect(err.name).toBe("ApiError");
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// apiFetch behaviour (tested through public functions)
// ---------------------------------------------------------------------------

describe("apiFetch behaviour", () => {
  it("successful GET request returns parsed JSON", async () => {
    const trees = [{ id: "t1", encrypted_data: "enc", created_at: "now", updated_at: "now" }];
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockResponse(trees));

    const result = await getTrees();

    expect(result).toEqual(trees);
    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees");
    expect(init.method).toBe("GET");
  });

  it("successful POST request sends JSON body", async () => {
    const tokenResp = {
      access_token: "at",
      refresh_token: "rt",
      token_type: "bearer",
      encryption_salt: "salt",
    };
    mockFetch.mockResolvedValueOnce(mockResponse(tokenResp));

    await login({ email: "a@b.com", password: DUMMY_PASS });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.com", password: DUMMY_PASS });
  });

  it("sends Authorization header when access token exists", async () => {
    setTokens("my-token", "ref");
    mockFetch.mockResolvedValueOnce(mockResponse([]));

    await getTrees();

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer my-token");
  });

  it("throws ApiError on non-ok response", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockResponse({}, 500));

    await expect(getTrees()).rejects.toThrow(ApiError);
    await expect(
      (async () => {
        setTokens("tok", "ref");
        mockFetch.mockResolvedValueOnce(mockResponse({}, 500));
        return getTrees();
      })(),
    ).rejects.toMatchObject({ status: 500 });
  });

  it("handles 204 No Content response by returning undefined", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockNoContentResponse());

    const result = await deleteEvent("tree-1", "event-1");
    expect(result).toBeUndefined();
  });

  it("extracts detail from JSON error body", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockResponse({ detail: "Email taken" }, 409));

    try {
      await getTrees();
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).detail).toBe("Email taken");
      expect((err as ApiError).status).toBe(409);
    }
  });
});

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

describe("token refresh", () => {
  it("retries the original request after refreshing on 401", async () => {
    setTokens("expired-tok", "valid-refresh");

    // First call: 401 error
    mockFetch.mockResolvedValueOnce(mockResponse({ detail: "Unauthorized" }, 401));
    // Refresh call: returns new access token
    mockFetch.mockResolvedValueOnce(
      mockResponse({ access_token: "new-tok", token_type: "bearer" }),
    );
    // Retry call: succeeds
    const trees = [{ id: "t1", encrypted_data: "x", created_at: "now", updated_at: "now" }];
    mockFetch.mockResolvedValueOnce(mockResponse(trees));

    const result = await getTrees();

    expect(result).toEqual(trees);
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Verify the refresh call
    const [refreshUrl, refreshInit] = mockFetch.mock.calls[1];
    expect(refreshUrl).toBe("/api/auth/refresh");
    expect(JSON.parse(refreshInit.body)).toEqual({ refresh_token: "valid-refresh" });

    // Verify new token was stored
    expect(getAccessToken()).toBe("new-tok");
  });

  it("clears tokens when refresh fails", async () => {
    setTokens("expired-tok", "bad-refresh");

    // First call: 401 error
    mockFetch.mockResolvedValueOnce(mockResponse({ detail: "Unauthorized" }, 401));
    // Refresh call: also fails
    mockFetch.mockResolvedValueOnce(mockResponse({ detail: "Invalid refresh" }, 401));

    await expect(getTrees()).rejects.toThrow(ApiError);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("does not retry on non-401 errors", async () => {
    setTokens("tok", "ref");

    mockFetch.mockResolvedValueOnce(mockResponse({ detail: "Forbidden" }, 403));

    await expect(getTrees()).rejects.toMatchObject({ status: 403 });
    // Only one fetch call -- no refresh attempt
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Auth functions
// ---------------------------------------------------------------------------

describe("auth functions", () => {
  it("register stores tokens when response has access_token", async () => {
    const resp = {
      access_token: "reg-at",
      refresh_token: "reg-rt",
      token_type: "bearer",
      encryption_salt: "salt",
    };
    mockFetch.mockResolvedValueOnce(mockResponse(resp));

    const result = await register({ email: "a@b.com", password: DUMMY_PASS, encryption_salt: "s" });

    expect(result).toEqual(resp);
    expect(getAccessToken()).toBe("reg-at");
    expect(getRefreshToken()).toBe("reg-rt");
  });

  it("register does not store tokens when response has no access_token (verification required)", async () => {
    const resp = { message: "Please verify your email" };
    mockFetch.mockResolvedValueOnce(mockResponse(resp));

    const result = await register({ email: "a@b.com", password: DUMMY_PASS, encryption_salt: "s" });

    expect(result).toEqual(resp);
    expect(getAccessToken()).toBeNull();
  });

  it("login stores tokens", async () => {
    const resp = {
      access_token: "login-at",
      refresh_token: "login-rt",
      token_type: "bearer",
      encryption_salt: "salt",
    };
    mockFetch.mockResolvedValueOnce(mockResponse(resp));

    await login({ email: "a@b.com", password: DUMMY_PASS });

    expect(getAccessToken()).toBe("login-at");
    expect(getRefreshToken()).toBe("login-rt");
  });

  it("logout clears tokens", () => {
    setTokens("a", "b");
    logout();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("getIsAdmin returns true when JWT payload has is_admin=true", () => {
    const token = fakeJwt({ sub: "user-1", is_admin: true });
    setTokens(token, "ref");
    expect(getIsAdmin()).toBe(true);
  });

  it("getIsAdmin returns false when is_admin is absent", () => {
    const token = fakeJwt({ sub: "user-1" });
    setTokens(token, "ref");
    expect(getIsAdmin()).toBe(false);
  });

  it("getIsAdmin returns false when no token exists", () => {
    expect(getIsAdmin()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CRUD functions
// ---------------------------------------------------------------------------

describe("CRUD functions", () => {
  it("createPerson sends POST to correct endpoint", async () => {
    setTokens("tok", "ref");
    const person = { id: "p1", encrypted_data: "enc", created_at: "now", updated_at: "now" };
    mockFetch.mockResolvedValueOnce(mockResponse(person));

    const result = await createPerson("tree-1", { encrypted_data: "enc" });

    expect(result).toEqual(person);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/persons");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ encrypted_data: "enc" });
  });

  it("updateRelationship sends PUT to correct endpoint", async () => {
    setTokens("tok", "ref");
    const rel = {
      id: "r1",
      source_person_id: "p1",
      target_person_id: "p2",
      encrypted_data: "enc",
      created_at: "now",
      updated_at: "now",
    };
    mockFetch.mockResolvedValueOnce(mockResponse(rel));

    const result = await updateRelationship("tree-1", "r1", { encrypted_data: "new-enc" });

    expect(result).toEqual(rel);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/relationships/r1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ encrypted_data: "new-enc" });
  });

  it("deleteEvent sends DELETE to correct endpoint", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockNoContentResponse());

    await deleteEvent("tree-1", "evt-1");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/events/evt-1");
    expect(init.method).toBe("DELETE");
  });

  it("syncTree sends POST to sync endpoint with batch payload", async () => {
    setTokens("tok", "ref");
    const syncResp = {
      persons_created: ["p1"],
      relationships_created: [],
      events_created: [],
      classifications_created: [],
      persons_updated: 0,
      relationships_updated: 0,
      events_updated: 0,
      classifications_updated: 0,
      persons_deleted: 0,
      relationships_deleted: 0,
      events_deleted: 0,
      classifications_deleted: 0,
    };
    mockFetch.mockResolvedValueOnce(mockResponse(syncResp));

    const syncData = {
      persons_create: [{ encrypted_data: "enc-person" }],
      persons_delete: [{ id: "old-p" }],
    };
    const result = await syncTree("tree-1", syncData);

    expect(result).toEqual(syncResp);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/sync");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(syncData);
  });
});

// ---------------------------------------------------------------------------
// Auth functions (remaining)
// ---------------------------------------------------------------------------

describe("auth functions (remaining)", () => {
  it("verifyEmail sends GET to /auth/verify with token query param", async () => {
    const resp = {
      access_token: "at",
      refresh_token: "rt",
      token_type: "bearer",
      encryption_salt: "s",
    };
    mockFetch.mockResolvedValueOnce(mockResponse(resp));

    const result = await verifyEmail("my-verify-token");

    expect(result).toEqual(resp);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/verify?token=my-verify-token");
    expect(init.method).toBe("GET");
  });

  it("verifyEmail encodes special characters in token", async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        access_token: "at",
        refresh_token: "rt",
        token_type: "bearer",
        encryption_salt: "s",
      }),
    );

    await verifyEmail("token with spaces&special=chars");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/verify?token=token%20with%20spaces%26special%3Dchars");
  });

  it("resendVerification sends POST to /auth/resend-verification", async () => {
    const resp = { message: "Verification email sent" };
    mockFetch.mockResolvedValueOnce(mockResponse(resp));

    const result = await resendVerification({ email: "user@example.com" });

    expect(result).toEqual(resp);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/resend-verification");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "user@example.com" });
  });

  it("getEncryptionSalt sends GET to /auth/salt", async () => {
    setTokens("tok", "ref");
    const resp = { encryption_salt: "base64salt" };
    mockFetch.mockResolvedValueOnce(mockResponse(resp));

    const result = await getEncryptionSalt();

    expect(result).toEqual(resp);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/salt");
    expect(init.method).toBe("GET");
  });

  it("changePassword sends PUT to /auth/password", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockNoContentResponse());

    await changePassword({ current_password: DUMMY_OLD_PASS, new_password: DUMMY_NEW_PASS });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/password");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      current_password: DUMMY_OLD_PASS,
      new_password: DUMMY_NEW_PASS,
    });
  });

  it("updateSalt sends PUT to /auth/salt", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockNoContentResponse());

    await updateSalt({ encryption_salt: "new-salt" });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/salt");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ encryption_salt: "new-salt" });
  });

  it("deleteAccount sends DELETE to /auth/account", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockNoContentResponse());

    await deleteAccount({ password: DUMMY_ACCOUNT_PASS });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/account");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({ password: DUMMY_ACCOUNT_PASS });
  });
});

// ---------------------------------------------------------------------------
// Tree functions
// ---------------------------------------------------------------------------

describe("tree functions", () => {
  it("getTree sends GET to /trees/{id}", async () => {
    setTokens("tok", "ref");
    const tree = { id: "t1", encrypted_data: "enc", created_at: "now", updated_at: "now" };
    mockFetch.mockResolvedValueOnce(mockResponse(tree));

    const result = await getTree("t1");

    expect(result).toEqual(tree);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/t1");
    expect(init.method).toBe("GET");
  });

  it("createTree sends POST to /trees", async () => {
    setTokens("tok", "ref");
    const tree = { id: "t1", encrypted_data: "enc", created_at: "now", updated_at: "now" };
    mockFetch.mockResolvedValueOnce(mockResponse(tree));

    const result = await createTree({ encrypted_data: "enc" });

    expect(result).toEqual(tree);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ encrypted_data: "enc" });
  });

  it("updateTree sends PUT to /trees/{id}", async () => {
    setTokens("tok", "ref");
    const tree = { id: "t1", encrypted_data: "updated", created_at: "now", updated_at: "now" };
    mockFetch.mockResolvedValueOnce(mockResponse(tree));

    const result = await updateTree("t1", { encrypted_data: "updated" });

    expect(result).toEqual(tree);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/t1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ encrypted_data: "updated" });
  });

  it("deleteTree sends DELETE to /trees/{id}", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockNoContentResponse());

    await deleteTree("t1");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/t1");
    expect(init.method).toBe("DELETE");
  });
});

// ---------------------------------------------------------------------------
// Person functions (remaining)
// ---------------------------------------------------------------------------

describe("person functions (remaining)", () => {
  it("getPersons sends GET to /trees/{treeId}/persons", async () => {
    setTokens("tok", "ref");
    const persons = [{ id: "p1", encrypted_data: "enc", created_at: "now", updated_at: "now" }];
    mockFetch.mockResolvedValueOnce(mockResponse(persons));

    const result = await getPersons("tree-1");

    expect(result).toEqual(persons);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/persons");
    expect(init.method).toBe("GET");
  });

  it("getPerson sends GET to /trees/{treeId}/persons/{personId}", async () => {
    setTokens("tok", "ref");
    const person = { id: "p1", encrypted_data: "enc", created_at: "now", updated_at: "now" };
    mockFetch.mockResolvedValueOnce(mockResponse(person));

    const result = await getPerson("tree-1", "p1");

    expect(result).toEqual(person);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/persons/p1");
    expect(init.method).toBe("GET");
  });

  it("updatePerson sends PUT to /trees/{treeId}/persons/{personId}", async () => {
    setTokens("tok", "ref");
    const person = { id: "p1", encrypted_data: "updated", created_at: "now", updated_at: "now" };
    mockFetch.mockResolvedValueOnce(mockResponse(person));

    const result = await updatePerson("tree-1", "p1", { encrypted_data: "updated" });

    expect(result).toEqual(person);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/persons/p1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ encrypted_data: "updated" });
  });

  it("deletePerson sends DELETE to /trees/{treeId}/persons/{personId}", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockNoContentResponse());

    await deletePerson("tree-1", "p1");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/persons/p1");
    expect(init.method).toBe("DELETE");
  });
});

// ---------------------------------------------------------------------------
// Relationship functions (remaining)
// ---------------------------------------------------------------------------

describe("relationship functions (remaining)", () => {
  it("getRelationships sends GET to /trees/{treeId}/relationships", async () => {
    setTokens("tok", "ref");
    const rels = [
      {
        id: "r1",
        source_person_id: "p1",
        target_person_id: "p2",
        encrypted_data: "enc",
        created_at: "now",
        updated_at: "now",
      },
    ];
    mockFetch.mockResolvedValueOnce(mockResponse(rels));

    const result = await getRelationships("tree-1");

    expect(result).toEqual(rels);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/relationships");
    expect(init.method).toBe("GET");
  });

  it("getRelationship sends GET to /trees/{treeId}/relationships/{relId}", async () => {
    setTokens("tok", "ref");
    const rel = {
      id: "r1",
      source_person_id: "p1",
      target_person_id: "p2",
      encrypted_data: "enc",
      created_at: "now",
      updated_at: "now",
    };
    mockFetch.mockResolvedValueOnce(mockResponse(rel));

    const result = await getRelationship("tree-1", "r1");

    expect(result).toEqual(rel);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/relationships/r1");
    expect(init.method).toBe("GET");
  });

  it("createRelationship sends POST to /trees/{treeId}/relationships", async () => {
    setTokens("tok", "ref");
    const rel = {
      id: "r1",
      source_person_id: "p1",
      target_person_id: "p2",
      encrypted_data: "enc",
      created_at: "now",
      updated_at: "now",
    };
    mockFetch.mockResolvedValueOnce(mockResponse(rel));

    const data = { source_person_id: "p1", target_person_id: "p2", encrypted_data: "enc" };
    const result = await createRelationship("tree-1", data);

    expect(result).toEqual(rel);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/relationships");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(data);
  });

  it("deleteRelationship sends DELETE to /trees/{treeId}/relationships/{relId}", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockNoContentResponse());

    await deleteRelationship("tree-1", "r1");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/relationships/r1");
    expect(init.method).toBe("DELETE");
  });
});

// ---------------------------------------------------------------------------
// Event functions (remaining)
// ---------------------------------------------------------------------------

describe("event functions (remaining)", () => {
  it("getEvents sends GET to /trees/{treeId}/events", async () => {
    setTokens("tok", "ref");
    const events = [{ id: "e1", encrypted_data: "enc", created_at: "now", updated_at: "now" }];
    mockFetch.mockResolvedValueOnce(mockResponse(events));

    const result = await getEvents("tree-1");

    expect(result).toEqual(events);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/events");
    expect(init.method).toBe("GET");
  });

  it("getEvent sends GET to /trees/{treeId}/events/{eventId}", async () => {
    setTokens("tok", "ref");
    const event = { id: "e1", encrypted_data: "enc", created_at: "now", updated_at: "now" };
    mockFetch.mockResolvedValueOnce(mockResponse(event));

    const result = await getEvent("tree-1", "e1");

    expect(result).toEqual(event);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/events/e1");
    expect(init.method).toBe("GET");
  });

  it("createEvent sends POST to /trees/{treeId}/events", async () => {
    setTokens("tok", "ref");
    const event = { id: "e1", encrypted_data: "enc", created_at: "now", updated_at: "now" };
    mockFetch.mockResolvedValueOnce(mockResponse(event));

    const data = { encrypted_data: "enc" };
    const result = await createEvent("tree-1", data);

    expect(result).toEqual(event);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/events");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(data);
  });

  it("updateEvent sends PUT to /trees/{treeId}/events/{eventId}", async () => {
    setTokens("tok", "ref");
    const event = { id: "e1", encrypted_data: "updated", created_at: "now", updated_at: "now" };
    mockFetch.mockResolvedValueOnce(mockResponse(event));

    const data = { encrypted_data: "updated" };
    const result = await updateEvent("tree-1", "e1", data);

    expect(result).toEqual(event);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/events/e1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual(data);
  });
});

// ---------------------------------------------------------------------------
// Life Event functions
// ---------------------------------------------------------------------------

describe("life event functions", () => {
  it("getLifeEvents sends GET to /trees/{treeId}/life-events", async () => {
    setTokens("tok", "ref");
    const lifeEvents = [{ id: "le1", encrypted_data: "enc", created_at: "now", updated_at: "now" }];
    mockFetch.mockResolvedValueOnce(mockResponse(lifeEvents));

    const result = await getLifeEvents("tree-1");

    expect(result).toEqual(lifeEvents);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/life-events");
    expect(init.method).toBe("GET");
  });

  it("getLifeEvent sends GET to /trees/{treeId}/life-events/{leId}", async () => {
    setTokens("tok", "ref");
    const lifeEvent = { id: "le1", encrypted_data: "enc", created_at: "now", updated_at: "now" };
    mockFetch.mockResolvedValueOnce(mockResponse(lifeEvent));

    const result = await getLifeEvent("tree-1", "le1");

    expect(result).toEqual(lifeEvent);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/life-events/le1");
    expect(init.method).toBe("GET");
  });

  it("createLifeEvent sends POST to /trees/{treeId}/life-events", async () => {
    setTokens("tok", "ref");
    const lifeEvent = { id: "le1", encrypted_data: "enc", created_at: "now", updated_at: "now" };
    mockFetch.mockResolvedValueOnce(mockResponse(lifeEvent));

    const data = { encrypted_data: "enc" };
    const result = await createLifeEvent("tree-1", data);

    expect(result).toEqual(lifeEvent);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/life-events");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(data);
  });

  it("updateLifeEvent sends PUT to /trees/{treeId}/life-events/{leId}", async () => {
    setTokens("tok", "ref");
    const lifeEvent = {
      id: "le1",
      encrypted_data: "updated",
      created_at: "now",
      updated_at: "now",
    };
    mockFetch.mockResolvedValueOnce(mockResponse(lifeEvent));

    const data = { encrypted_data: "updated" };
    const result = await updateLifeEvent("tree-1", "le1", data);

    expect(result).toEqual(lifeEvent);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/life-events/le1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual(data);
  });

  it("deleteLifeEvent sends DELETE to /trees/{treeId}/life-events/{leId}", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockNoContentResponse());

    await deleteLifeEvent("tree-1", "le1");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/life-events/le1");
    expect(init.method).toBe("DELETE");
  });
});

// ---------------------------------------------------------------------------
// Classification functions
// ---------------------------------------------------------------------------

describe("classification functions", () => {
  it("getClassifications sends GET to /trees/{treeId}/classifications", async () => {
    setTokens("tok", "ref");
    const classifications = [
      { id: "c1", encrypted_data: "enc", created_at: "now", updated_at: "now" },
    ];
    mockFetch.mockResolvedValueOnce(mockResponse(classifications));

    const result = await getClassifications("tree-1");

    expect(result).toEqual(classifications);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/classifications");
    expect(init.method).toBe("GET");
  });

  it("getClassification sends GET to /trees/{treeId}/classifications/{clsId}", async () => {
    setTokens("tok", "ref");
    const classification = {
      id: "c1",
      encrypted_data: "enc",
      created_at: "now",
      updated_at: "now",
    };
    mockFetch.mockResolvedValueOnce(mockResponse(classification));

    const result = await getClassification("tree-1", "c1");

    expect(result).toEqual(classification);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/classifications/c1");
    expect(init.method).toBe("GET");
  });

  it("createClassification sends POST to /trees/{treeId}/classifications", async () => {
    setTokens("tok", "ref");
    const classification = {
      id: "c1",
      encrypted_data: "enc",
      created_at: "now",
      updated_at: "now",
    };
    mockFetch.mockResolvedValueOnce(mockResponse(classification));

    const data = { encrypted_data: "enc" };
    const result = await createClassification("tree-1", data);

    expect(result).toEqual(classification);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/classifications");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(data);
  });

  it("updateClassification sends PUT to /trees/{treeId}/classifications/{clsId}", async () => {
    setTokens("tok", "ref");
    const classification = {
      id: "c1",
      encrypted_data: "updated",
      created_at: "now",
      updated_at: "now",
    };
    mockFetch.mockResolvedValueOnce(mockResponse(classification));

    const data = { encrypted_data: "updated" };
    const result = await updateClassification("tree-1", "c1", data);

    expect(result).toEqual(classification);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/classifications/c1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual(data);
  });

  it("deleteClassification sends DELETE to /trees/{treeId}/classifications/{clsId}", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockNoContentResponse());

    await deleteClassification("tree-1", "c1");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/classifications/c1");
    expect(init.method).toBe("DELETE");
  });
});

// ---------------------------------------------------------------------------
// Admin functions
// ---------------------------------------------------------------------------

describe("admin functions", () => {
  it("getAdminOverview sends GET to /admin/stats/overview", async () => {
    setTokens("tok", "ref");
    const stats = { total_users: 10, total_trees: 5 };
    mockFetch.mockResolvedValueOnce(mockResponse(stats));

    const result = await getAdminOverview();

    expect(result).toEqual(stats);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/stats/overview");
    expect(init.method).toBe("GET");
  });

  it("getAdminRetention sends GET to /admin/stats/retention with default weeks", async () => {
    setTokens("tok", "ref");
    const stats = { weeks: [] };
    mockFetch.mockResolvedValueOnce(mockResponse(stats));

    const result = await getAdminRetention();

    expect(result).toEqual(stats);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/stats/retention?weeks=12");
    expect(init.method).toBe("GET");
  });

  it("getAdminRetention sends GET to /admin/stats/retention with custom weeks", async () => {
    setTokens("tok", "ref");
    const stats = { weeks: [] };
    mockFetch.mockResolvedValueOnce(mockResponse(stats));

    const result = await getAdminRetention(4);

    expect(result).toEqual(stats);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/stats/retention?weeks=4");
  });

  it("getAdminUsage sends GET to /admin/stats/usage", async () => {
    setTokens("tok", "ref");
    const stats = { avg_persons_per_tree: 3 };
    mockFetch.mockResolvedValueOnce(mockResponse(stats));

    const result = await getAdminUsage();

    expect(result).toEqual(stats);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/stats/usage");
    expect(init.method).toBe("GET");
  });

  it("getAdminFunnel sends GET to /admin/stats/funnel", async () => {
    setTokens("tok", "ref");
    const stats = { registered: 100, verified: 80 };
    mockFetch.mockResolvedValueOnce(mockResponse(stats));

    const result = await getAdminFunnel();

    expect(result).toEqual(stats);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/stats/funnel");
    expect(init.method).toBe("GET");
  });

  it("getAdminActivity sends GET to /admin/stats/activity", async () => {
    setTokens("tok", "ref");
    const stats = { daily_active: 5 };
    mockFetch.mockResolvedValueOnce(mockResponse(stats));

    const result = await getAdminActivity();

    expect(result).toEqual(stats);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/stats/activity");
    expect(init.method).toBe("GET");
  });

  it("getAdminGrowth sends GET to /admin/stats/growth", async () => {
    setTokens("tok", "ref");
    const stats = { monthly_signups: [10, 20, 30] };
    mockFetch.mockResolvedValueOnce(mockResponse(stats));

    const result = await getAdminGrowth();

    expect(result).toEqual(stats);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/stats/growth");
    expect(init.method).toBe("GET");
  });

  it("getAdminUsers sends GET to /admin/stats/users", async () => {
    setTokens("tok", "ref");
    const stats = { users: [{ id: "u1", email: "a@b.com" }] };
    mockFetch.mockResolvedValueOnce(mockResponse(stats));

    const result = await getAdminUsers();

    expect(result).toEqual(stats);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/stats/users");
    expect(init.method).toBe("GET");
  });
});

// ---------------------------------------------------------------------------
// Pattern functions
// ---------------------------------------------------------------------------

describe("pattern functions", () => {
  it("getPatterns sends GET to /trees/{treeId}/patterns", async () => {
    setTokens("tok", "ref");
    const patterns = [{ id: "pat1", encrypted_data: "enc", created_at: "now", updated_at: "now" }];
    mockFetch.mockResolvedValueOnce(mockResponse(patterns));

    const result = await getPatterns("tree-1");

    expect(result).toEqual(patterns);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/patterns");
    expect(init.method).toBe("GET");
  });

  it("getPattern sends GET to /trees/{treeId}/patterns/{patternId}", async () => {
    setTokens("tok", "ref");
    const pattern = {
      id: "pat1",
      encrypted_data: "enc",
      created_at: "now",
      updated_at: "now",
    };
    mockFetch.mockResolvedValueOnce(mockResponse(pattern));

    const result = await getPattern("tree-1", "pat1");

    expect(result).toEqual(pattern);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/patterns/pat1");
    expect(init.method).toBe("GET");
  });

  it("createPattern sends POST to /trees/{treeId}/patterns", async () => {
    setTokens("tok", "ref");
    const pattern = {
      id: "pat1",
      encrypted_data: "enc",
      created_at: "now",
      updated_at: "now",
    };
    mockFetch.mockResolvedValueOnce(mockResponse(pattern));

    const data = { encrypted_data: "enc" };
    const result = await createPattern("tree-1", data);

    expect(result).toEqual(pattern);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/patterns");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(data);
  });

  it("updatePattern sends PUT to /trees/{treeId}/patterns/{patternId}", async () => {
    setTokens("tok", "ref");
    const pattern = {
      id: "pat1",
      encrypted_data: "updated",
      created_at: "now",
      updated_at: "now",
    };
    mockFetch.mockResolvedValueOnce(mockResponse(pattern));

    const data = { encrypted_data: "updated" };
    const result = await updatePattern("tree-1", "pat1", data);

    expect(result).toEqual(pattern);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/patterns/pat1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual(data);
  });

  it("deletePattern sends DELETE to /trees/{treeId}/patterns/{patternId}", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockNoContentResponse());

    await deletePattern("tree-1", "pat1");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/trees/tree-1/patterns/pat1");
    expect(init.method).toBe("DELETE");
  });
});

// ---------------------------------------------------------------------------
// Feedback functions
// ---------------------------------------------------------------------------

describe("feedback functions", () => {
  it("getAdminFeedback sends GET to /admin/feedback", async () => {
    setTokens("tok", "ref");
    const data = { items: [{ id: "f1", category: "bug", message: "broken" }] };
    mockFetch.mockResolvedValueOnce(mockResponse(data));

    const result = await getAdminFeedback();

    expect(result).toEqual(data);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/feedback");
    expect(init.method).toBe("GET");
  });

  it("submitFeedback sends POST to /feedback", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockNoContentResponse());

    await submitFeedback({ category: "bug", message: "broken", anonymous: false });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/feedback");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ category: "bug", message: "broken", anonymous: false });
  });

  it("markFeedbackRead sends PATCH to /admin/feedback/{id}/read", async () => {
    setTokens("tok", "ref");
    const data = { id: "f1", category: "bug", message: "broken", is_read: true };
    mockFetch.mockResolvedValueOnce(mockResponse(data));

    const result = await markFeedbackRead("f1");

    expect(result).toEqual(data);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/feedback/f1/read");
    expect(init.method).toBe("PATCH");
  });

  it("deleteFeedback sends DELETE to /admin/feedback/{id}", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockNoContentResponse());

    await deleteFeedback("f1");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/feedback/f1");
    expect(init.method).toBe("DELETE");
  });
});

// ---------------------------------------------------------------------------
// Waitlist functions
// ---------------------------------------------------------------------------

describe("waitlist functions", () => {
  it("joinWaitlist sends POST to /waitlist", async () => {
    const data = { message: "joined_waitlist" };
    mockFetch.mockResolvedValueOnce(mockResponse(data, 201));

    const result = await joinWaitlist("test@example.com");

    expect(result).toEqual(data);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/waitlist");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "test@example.com" });
  });

  it("getAdminWaitlist sends GET to /admin/waitlist", async () => {
    setTokens("tok", "ref");
    const data = { items: [], waiting: 0, approved: 0, registered: 0 };
    mockFetch.mockResolvedValueOnce(mockResponse(data));

    const result = await getAdminWaitlist();

    expect(result).toEqual(data);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/waitlist");
    expect(init.method).toBe("GET");
  });

  it("approveWaitlistEntry sends PATCH to /admin/waitlist/{id}/approve", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockNoContentResponse());

    await approveWaitlistEntry("entry-1");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/waitlist/entry-1/approve");
    expect(init.method).toBe("PATCH");
  });

  it("deleteWaitlistEntry sends DELETE to /admin/waitlist/{id}", async () => {
    setTokens("tok", "ref");
    mockFetch.mockResolvedValueOnce(mockNoContentResponse());

    await deleteWaitlistEntry("entry-1");

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/waitlist/entry-1");
    expect(init.method).toBe("DELETE");
  });

  it("getAdminWaitlistCapacity sends GET to /admin/waitlist/capacity", async () => {
    setTokens("tok", "ref");
    const data = { active_users: 5, max_active_users: 20, waitlist_enabled: true };
    mockFetch.mockResolvedValueOnce(mockResponse(data));

    const result = await getAdminWaitlistCapacity();

    expect(result).toEqual(data);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/admin/waitlist/capacity");
    expect(init.method).toBe("GET");
  });
});
