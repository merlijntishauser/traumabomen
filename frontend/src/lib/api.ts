import type {
  ActivityStats,
  ChangePasswordRequest,
  ClassificationCreate,
  ClassificationResponse,
  ClassificationUpdate,
  DeleteAccountRequest,
  EventCreate,
  EventResponse,
  EventUpdate,
  FeedbackCreate,
  FeedbackItem,
  FunnelStats,
  GrowthStats,
  JournalEntryCreate,
  JournalEntryResponse,
  JournalEntryUpdate,
  KeyRingResponse,
  LifeEventCreate,
  LifeEventResponse,
  LifeEventUpdate,
  LoginRequest,
  MigrateKeysRequest,
  OverviewStats,
  PatternCreate,
  PatternResponse,
  PatternUpdate,
  PersonCreate,
  PersonResponse,
  PersonUpdate,
  RefreshResponse,
  RegisterRequest,
  RegisterResponse,
  RelationshipCreate,
  RelationshipResponse,
  RelationshipUpdate,
  ResendVerificationRequest,
  RetentionStats,
  SaltResponse,
  SyncRequest,
  SyncResponse,
  TokenResponse,
  TreeCreate,
  TreeResponse,
  TreeUpdate,
  TurningPointCreate,
  TurningPointResponse,
  TurningPointUpdate,
  UpdateSaltRequest,
  UsageStats,
  UserListStats,
  VerifyResponse,
  WaitlistCapacity,
  WaitlistListResponse,
} from "../types/api";

const TOKEN_KEY = "traumabomen_access_token";
const REFRESH_KEY = "traumabomen_refresh_token";
const ONBOARDING_KEY = "traumabomen_onboarding_acknowledged";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

// Token management

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(ONBOARDING_KEY);
}

// Onboarding flag management

export function getOnboardingFlag(): boolean {
  return localStorage.getItem(ONBOARDING_KEY) === "true";
}

export function setOnboardingFlag(value: boolean): void {
  localStorage.setItem(ONBOARDING_KEY, String(value));
}

// Core fetch

interface FetchOptions {
  method?: string;
  body?: unknown;
  requiresAuth?: boolean;
}

async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, requiresAuth = true } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (requiresAuth) {
    const token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`/api${endpoint}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errorBody = await response.json();
      detail = errorBody.detail ?? detail;
    } catch {
      // use statusText
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
      const data = await apiFetch<RefreshResponse>("/auth/refresh", {
        method: "POST",
        body: { refresh_token: refreshToken },
        requiresAuth: false,
      });
      localStorage.setItem(TOKEN_KEY, data.access_token);
      return true;
    } catch {
      clearTokens();
      return false;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function apiFetchWithRetry<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  try {
    return await apiFetch<T>(endpoint, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiFetch<T>(endpoint, options);
      }
    }
    throw error;
  }
}

// Auth

export async function register(
  request: RegisterRequest,
): Promise<TokenResponse | RegisterResponse> {
  const data = await apiFetch<TokenResponse | RegisterResponse>("/auth/register", {
    method: "POST",
    body: request,
    requiresAuth: false,
  });
  if ("access_token" in data) {
    setTokens(data.access_token, data.refresh_token);
    setOnboardingFlag(false);
  }
  return data;
}

export async function verifyEmail(token: string): Promise<VerifyResponse> {
  return apiFetch<VerifyResponse>(`/auth/verify?token=${encodeURIComponent(token)}`, {
    requiresAuth: false,
  });
}

export async function resendVerification(
  request: ResendVerificationRequest,
): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>("/auth/resend-verification", {
    method: "POST",
    body: request,
    requiresAuth: false,
  });
}

export async function login(request: LoginRequest): Promise<TokenResponse> {
  const data = await apiFetch<TokenResponse>("/auth/login", {
    method: "POST",
    body: request,
    requiresAuth: false,
  });
  setTokens(data.access_token, data.refresh_token);
  setOnboardingFlag(data.onboarding_safety_acknowledged);
  return data;
}

export function logout(): void {
  clearTokens();
}

export async function acknowledgeOnboarding(): Promise<void> {
  await apiFetchWithRetry("/auth/onboarding", { method: "PUT" });
  setOnboardingFlag(true);
}

export function getEncryptionSalt(): Promise<SaltResponse> {
  return apiFetchWithRetry("/auth/salt");
}

export function changePassword(data: ChangePasswordRequest): Promise<void> {
  return apiFetchWithRetry("/auth/password", { method: "PUT", body: data });
}

export function updateSalt(data: UpdateSaltRequest): Promise<void> {
  return apiFetchWithRetry("/auth/salt", { method: "PUT", body: data });
}

export function deleteAccount(data: DeleteAccountRequest): Promise<void> {
  return apiFetchWithRetry("/auth/account", { method: "DELETE", body: data });
}

// Key ring

export function getKeyRing(): Promise<KeyRingResponse> {
  return apiFetchWithRetry("/auth/key-ring");
}

export function updateKeyRing(encrypted_key_ring: string): Promise<void> {
  return apiFetchWithRetry("/auth/key-ring", {
    method: "PUT",
    body: { encrypted_key_ring },
  });
}

export function migrateKeys(data: MigrateKeysRequest): Promise<void> {
  return apiFetchWithRetry("/auth/migrate-keys", {
    method: "POST",
    body: data,
  });
}

// Tree-scoped CRUD factory

interface CrudApi<TResponse, TCreate, TUpdate> {
  getAll: (treeId: string) => Promise<TResponse[]>;
  getOne: (treeId: string, itemId: string) => Promise<TResponse>;
  create: (treeId: string, data: TCreate) => Promise<TResponse>;
  update: (treeId: string, itemId: string, data: TUpdate) => Promise<TResponse>;
  remove: (treeId: string, itemId: string) => Promise<void>;
}

function makeCrudApi<TResponse, TCreate, TUpdate>(
  segment: string,
): CrudApi<TResponse, TCreate, TUpdate> {
  return {
    getAll: (treeId) => apiFetchWithRetry(`/trees/${treeId}/${segment}`),
    getOne: (treeId, itemId) => apiFetchWithRetry(`/trees/${treeId}/${segment}/${itemId}`),
    create: (treeId, data) =>
      apiFetchWithRetry(`/trees/${treeId}/${segment}`, { method: "POST", body: data }),
    update: (treeId, itemId, data) =>
      apiFetchWithRetry(`/trees/${treeId}/${segment}/${itemId}`, { method: "PUT", body: data }),
    remove: (treeId, itemId) =>
      apiFetchWithRetry(`/trees/${treeId}/${segment}/${itemId}`, { method: "DELETE" }),
  };
}

// Trees

export function getTrees(): Promise<TreeResponse[]> {
  return apiFetchWithRetry("/trees");
}

export function getTree(id: string): Promise<TreeResponse> {
  return apiFetchWithRetry(`/trees/${id}`);
}

export function createTree(data: TreeCreate): Promise<TreeResponse> {
  return apiFetchWithRetry("/trees", { method: "POST", body: data });
}

export function updateTree(id: string, data: TreeUpdate): Promise<TreeResponse> {
  return apiFetchWithRetry(`/trees/${id}`, { method: "PUT", body: data });
}

export function deleteTree(id: string): Promise<void> {
  return apiFetchWithRetry(`/trees/${id}`, { method: "DELETE" });
}

// Persons

const personsApi = makeCrudApi<PersonResponse, PersonCreate, PersonUpdate>("persons");
export const getPersons = personsApi.getAll;
export const getPerson = personsApi.getOne;
export const createPerson = personsApi.create;
export const updatePerson = personsApi.update;
export const deletePerson = personsApi.remove;

// Relationships

const relationshipsApi = makeCrudApi<RelationshipResponse, RelationshipCreate, RelationshipUpdate>(
  "relationships",
);
export const getRelationships = relationshipsApi.getAll;
export const getRelationship = relationshipsApi.getOne;
export const createRelationship = relationshipsApi.create;
export const updateRelationship = relationshipsApi.update;
export const deleteRelationship = relationshipsApi.remove;

// Events

const eventsApi = makeCrudApi<EventResponse, EventCreate, EventUpdate>("events");
export const getEvents = eventsApi.getAll;
export const getEvent = eventsApi.getOne;
export const createEvent = eventsApi.create;
export const updateEvent = eventsApi.update;
export const deleteEvent = eventsApi.remove;

// Life Events

const lifeEventsApi = makeCrudApi<LifeEventResponse, LifeEventCreate, LifeEventUpdate>(
  "life-events",
);
export const getLifeEvents = lifeEventsApi.getAll;
export const getLifeEvent = lifeEventsApi.getOne;
export const createLifeEvent = lifeEventsApi.create;
export const updateLifeEvent = lifeEventsApi.update;
export const deleteLifeEvent = lifeEventsApi.remove;

// Turning Points

const turningPointsApi = makeCrudApi<TurningPointResponse, TurningPointCreate, TurningPointUpdate>(
  "turning-points",
);
export const getTurningPoints = turningPointsApi.getAll;
export const createTurningPoint = turningPointsApi.create;
export const updateTurningPoint = turningPointsApi.update;
export const deleteTurningPoint = turningPointsApi.remove;

// Journal

const journalApi = makeCrudApi<JournalEntryResponse, JournalEntryCreate, JournalEntryUpdate>(
  "journal",
);
export const getJournalEntries = journalApi.getAll;
export const createJournalEntry = journalApi.create;
export const updateJournalEntry = journalApi.update;
export const deleteJournalEntry = journalApi.remove;

// Classifications

const classificationsApi = makeCrudApi<
  ClassificationResponse,
  ClassificationCreate,
  ClassificationUpdate
>("classifications");
export const getClassifications = classificationsApi.getAll;
export const getClassification = classificationsApi.getOne;
export const createClassification = classificationsApi.create;
export const updateClassification = classificationsApi.update;
export const deleteClassification = classificationsApi.remove;

// Patterns

const patternsApi = makeCrudApi<PatternResponse, PatternCreate, PatternUpdate>("patterns");
export const getPatterns = patternsApi.getAll;
export const getPattern = patternsApi.getOne;
export const createPattern = patternsApi.create;
export const updatePattern = patternsApi.update;
export const deletePattern = patternsApi.remove;

// Sync

export function syncTree(treeId: string, data: SyncRequest): Promise<SyncResponse> {
  return apiFetchWithRetry(`/trees/${treeId}/sync`, {
    method: "POST",
    body: data,
  });
}

// Admin

export function getIsAdmin(): boolean {
  const token = getAccessToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.is_admin === true;
  } catch {
    return false;
  }
}

export function getAdminOverview(): Promise<OverviewStats> {
  return apiFetchWithRetry("/admin/stats/overview");
}

export function getAdminRetention(weeks = 12): Promise<RetentionStats> {
  return apiFetchWithRetry(`/admin/stats/retention?weeks=${weeks}`);
}

export function getAdminUsage(): Promise<UsageStats> {
  return apiFetchWithRetry("/admin/stats/usage");
}

export function getAdminFunnel(): Promise<FunnelStats> {
  return apiFetchWithRetry("/admin/stats/funnel");
}

export function getAdminActivity(): Promise<ActivityStats> {
  return apiFetchWithRetry("/admin/stats/activity");
}

export function getAdminGrowth(): Promise<GrowthStats> {
  return apiFetchWithRetry("/admin/stats/growth");
}

export function getAdminUsers(): Promise<UserListStats> {
  return apiFetchWithRetry("/admin/stats/users");
}

export function getAdminFeedback(): Promise<{ items: FeedbackItem[] }> {
  return apiFetchWithRetry("/admin/feedback");
}

// Feedback

export function submitFeedback(data: FeedbackCreate): Promise<void> {
  return apiFetchWithRetry("/feedback", { method: "POST", body: data });
}

export function markFeedbackRead(id: string): Promise<FeedbackItem> {
  return apiFetchWithRetry(`/admin/feedback/${id}/read`, { method: "PATCH" });
}

export function deleteFeedback(id: string): Promise<void> {
  return apiFetchWithRetry(`/admin/feedback/${id}`, { method: "DELETE" });
}

// Waitlist

export function joinWaitlist(email: string): Promise<{ message: string }> {
  return apiFetch("/waitlist", { method: "POST", body: { email }, requiresAuth: false });
}

export function getAdminWaitlist(): Promise<WaitlistListResponse> {
  return apiFetchWithRetry("/admin/waitlist");
}

export function approveWaitlistEntry(id: string): Promise<void> {
  return apiFetchWithRetry(`/admin/waitlist/${id}/approve`, { method: "PATCH" });
}

export function deleteWaitlistEntry(id: string): Promise<void> {
  return apiFetchWithRetry(`/admin/waitlist/${id}`, { method: "DELETE" });
}

export function getAdminWaitlistCapacity(): Promise<WaitlistCapacity> {
  return apiFetchWithRetry("/admin/waitlist/capacity");
}
