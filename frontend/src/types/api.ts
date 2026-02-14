// Auth
export interface RegisterRequest {
  email: string;
  password: string;
  encryption_salt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  encryption_salt: string;
}

export interface RegisterResponse {
  message: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface VerifyResponse {
  message: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  token_type: string;
}

export interface SaltResponse {
  encryption_salt: string;
}

// Trees
export interface TreeCreate {
  encrypted_data: string;
}

export interface TreeUpdate {
  encrypted_data: string;
}

export interface TreeResponse {
  id: string;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}

// Persons
export interface PersonCreate {
  encrypted_data: string;
}

export interface PersonUpdate {
  encrypted_data: string;
}

export interface PersonResponse {
  id: string;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}

// Relationships
export interface RelationshipCreate {
  source_person_id: string;
  target_person_id: string;
  encrypted_data: string;
}

export interface RelationshipUpdate {
  source_person_id?: string;
  target_person_id?: string;
  encrypted_data?: string;
}

export interface RelationshipResponse {
  id: string;
  source_person_id: string;
  target_person_id: string;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}

// Events
export interface EventCreate {
  person_ids: string[];
  encrypted_data: string;
}

export interface EventUpdate {
  person_ids?: string[];
  encrypted_data?: string;
}

export interface EventResponse {
  id: string;
  person_ids: string[];
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}

// Life Events
export interface LifeEventCreate {
  person_ids: string[];
  encrypted_data: string;
}

export interface LifeEventUpdate {
  person_ids?: string[];
  encrypted_data?: string;
}

export interface LifeEventResponse {
  id: string;
  person_ids: string[];
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}

// Admin stats
export interface PeriodCounts {
  day: number;
  week: number;
  month: number;
}

export interface OverviewStats {
  total_users: number;
  verified_users: number;
  signups: PeriodCounts;
  active_users: PeriodCounts;
}

export interface CohortRow {
  week: string;
  signup_count: number;
  retention: number[];
}

export interface RetentionStats {
  cohorts: CohortRow[];
}

export interface UsageBuckets {
  zero: number;
  one_two: number;
  three_five: number;
  six_ten: number;
  eleven_twenty: number;
  twenty_plus: number;
}

export interface UsageStats {
  persons: UsageBuckets;
  relationships: UsageBuckets;
  events: UsageBuckets;
}

// Sync
export interface SyncPersonCreate {
  id?: string;
  encrypted_data: string;
}

export interface SyncPersonUpdate {
  id: string;
  encrypted_data: string;
}

export interface SyncRelationshipCreate {
  id?: string;
  source_person_id: string;
  target_person_id: string;
  encrypted_data: string;
}

export interface SyncRelationshipUpdate {
  id: string;
  source_person_id?: string;
  target_person_id?: string;
  encrypted_data?: string;
}

export interface SyncEventCreate {
  id?: string;
  person_ids: string[];
  encrypted_data: string;
}

export interface SyncEventUpdate {
  id: string;
  person_ids?: string[];
  encrypted_data?: string;
}

export interface SyncDelete {
  id: string;
}

export interface SyncRequest {
  persons_create?: SyncPersonCreate[];
  persons_update?: SyncPersonUpdate[];
  persons_delete?: SyncDelete[];
  relationships_create?: SyncRelationshipCreate[];
  relationships_update?: SyncRelationshipUpdate[];
  relationships_delete?: SyncDelete[];
  events_create?: SyncEventCreate[];
  events_update?: SyncEventUpdate[];
  events_delete?: SyncDelete[];
}

export interface SyncResponse {
  persons_created: string[];
  relationships_created: string[];
  events_created: string[];
  persons_updated: number;
  relationships_updated: number;
  events_updated: number;
  persons_deleted: number;
  relationships_deleted: number;
  events_deleted: number;
}
