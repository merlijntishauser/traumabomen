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
  onboarding_safety_acknowledged: boolean;
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

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface UpdateSaltRequest {
  encryption_salt: string;
}

export interface DeleteAccountRequest {
  password: string;
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

// Classifications
export interface ClassificationCreate {
  person_ids: string[];
  encrypted_data: string;
}

export interface ClassificationUpdate {
  person_ids?: string[];
  encrypted_data?: string;
}

export interface ClassificationResponse {
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

export interface FunnelStats {
  registered: number;
  verified: number;
  created_tree: number;
  added_person: number;
  added_relationship: number;
  added_event: number;
}

export interface ActivityCell {
  day: number;
  hour: number;
  count: number;
}

export interface ActivityStats {
  cells: ActivityCell[];
}

export interface GrowthPoint {
  date: string;
  total: number;
}

export interface GrowthStats {
  points: GrowthPoint[];
}

export interface UserRow {
  id: string;
  email: string;
  created_at: string;
  email_verified: boolean;
  last_login: string | null;
  tree_count: number;
  person_count: number;
  relationship_count: number;
  event_count: number;
}

export interface UserListStats {
  users: UserRow[];
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

export interface SyncClassificationCreate {
  id?: string;
  person_ids: string[];
  encrypted_data: string;
}

export interface SyncClassificationUpdate {
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
  classifications_create?: SyncClassificationCreate[];
  classifications_update?: SyncClassificationUpdate[];
  classifications_delete?: SyncDelete[];
}

export interface SyncResponse {
  persons_created: string[];
  relationships_created: string[];
  events_created: string[];
  classifications_created: string[];
  persons_updated: number;
  relationships_updated: number;
  events_updated: number;
  classifications_updated: number;
  persons_deleted: number;
  relationships_deleted: number;
  events_deleted: number;
  classifications_deleted: number;
}
