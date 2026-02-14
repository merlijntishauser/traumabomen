import type {
  ActivityStats,
  ChangePasswordRequest,
  DeleteAccountRequest,
  EventCreate,
  EventResponse,
  EventUpdate,
  FunnelStats,
  GrowthStats,
  LifeEventCreate,
  LifeEventResponse,
  LifeEventUpdate,
  LoginRequest,
  OverviewStats,
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
  UpdateSaltRequest,
  UsageStats,
  UserListStats,
  VerifyResponse,
} from "../types/api";

const TOKEN_KEY = "traumabomen_access_token";
const REFRESH_KEY = "traumabomen_refresh_token";

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
  return data;
}

export function logout(): void {
  clearTokens();
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

export function getPersons(treeId: string): Promise<PersonResponse[]> {
  return apiFetchWithRetry(`/trees/${treeId}/persons`);
}

export function getPerson(treeId: string, personId: string): Promise<PersonResponse> {
  return apiFetchWithRetry(`/trees/${treeId}/persons/${personId}`);
}

export function createPerson(treeId: string, data: PersonCreate): Promise<PersonResponse> {
  return apiFetchWithRetry(`/trees/${treeId}/persons`, {
    method: "POST",
    body: data,
  });
}

export function updatePerson(
  treeId: string,
  personId: string,
  data: PersonUpdate,
): Promise<PersonResponse> {
  return apiFetchWithRetry(`/trees/${treeId}/persons/${personId}`, {
    method: "PUT",
    body: data,
  });
}

export function deletePerson(treeId: string, personId: string): Promise<void> {
  return apiFetchWithRetry(`/trees/${treeId}/persons/${personId}`, {
    method: "DELETE",
  });
}

// Relationships

export function getRelationships(treeId: string): Promise<RelationshipResponse[]> {
  return apiFetchWithRetry(`/trees/${treeId}/relationships`);
}

export function getRelationship(
  treeId: string,
  relationshipId: string,
): Promise<RelationshipResponse> {
  return apiFetchWithRetry(`/trees/${treeId}/relationships/${relationshipId}`);
}

export function createRelationship(
  treeId: string,
  data: RelationshipCreate,
): Promise<RelationshipResponse> {
  return apiFetchWithRetry(`/trees/${treeId}/relationships`, {
    method: "POST",
    body: data,
  });
}

export function updateRelationship(
  treeId: string,
  relationshipId: string,
  data: RelationshipUpdate,
): Promise<RelationshipResponse> {
  return apiFetchWithRetry(`/trees/${treeId}/relationships/${relationshipId}`, {
    method: "PUT",
    body: data,
  });
}

export function deleteRelationship(treeId: string, relationshipId: string): Promise<void> {
  return apiFetchWithRetry(`/trees/${treeId}/relationships/${relationshipId}`, {
    method: "DELETE",
  });
}

// Events

export function getEvents(treeId: string): Promise<EventResponse[]> {
  return apiFetchWithRetry(`/trees/${treeId}/events`);
}

export function getEvent(treeId: string, eventId: string): Promise<EventResponse> {
  return apiFetchWithRetry(`/trees/${treeId}/events/${eventId}`);
}

export function createEvent(treeId: string, data: EventCreate): Promise<EventResponse> {
  return apiFetchWithRetry(`/trees/${treeId}/events`, {
    method: "POST",
    body: data,
  });
}

export function updateEvent(
  treeId: string,
  eventId: string,
  data: EventUpdate,
): Promise<EventResponse> {
  return apiFetchWithRetry(`/trees/${treeId}/events/${eventId}`, {
    method: "PUT",
    body: data,
  });
}

export function deleteEvent(treeId: string, eventId: string): Promise<void> {
  return apiFetchWithRetry(`/trees/${treeId}/events/${eventId}`, {
    method: "DELETE",
  });
}

// Life Events

export function getLifeEvents(treeId: string): Promise<LifeEventResponse[]> {
  return apiFetchWithRetry(`/trees/${treeId}/life-events`);
}

export function getLifeEvent(treeId: string, lifeEventId: string): Promise<LifeEventResponse> {
  return apiFetchWithRetry(`/trees/${treeId}/life-events/${lifeEventId}`);
}

export function createLifeEvent(treeId: string, data: LifeEventCreate): Promise<LifeEventResponse> {
  return apiFetchWithRetry(`/trees/${treeId}/life-events`, {
    method: "POST",
    body: data,
  });
}

export function updateLifeEvent(
  treeId: string,
  lifeEventId: string,
  data: LifeEventUpdate,
): Promise<LifeEventResponse> {
  return apiFetchWithRetry(`/trees/${treeId}/life-events/${lifeEventId}`, {
    method: "PUT",
    body: data,
  });
}

export function deleteLifeEvent(treeId: string, lifeEventId: string): Promise<void> {
  return apiFetchWithRetry(`/trees/${treeId}/life-events/${lifeEventId}`, {
    method: "DELETE",
  });
}

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
