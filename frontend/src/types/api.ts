// Auth
export interface RegisterRequest {
  email: string;
  password: string;
  encryption_salt: string;
  invite_token?: string;
  language?: string;
  passphrase_hint?: string;
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
  language?: string;
}

export interface VerifyResponse {
  message: string;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface SaltResponse {
  encryption_salt: string;
  passphrase_hint: string | null;
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

export interface KeyRingResponse {
  encrypted_key_ring: string;
}

export interface MigrateKeysEntity {
  id: string;
  encrypted_data: string;
}

export interface MigrateKeysTree {
  tree_id: string;
  encrypted_data: string;
  persons: MigrateKeysEntity[];
  relationships: MigrateKeysEntity[];
  events: MigrateKeysEntity[];
  life_events: MigrateKeysEntity[];
  turning_points: MigrateKeysEntity[];
  classifications: MigrateKeysEntity[];
  patterns: MigrateKeysEntity[];
  journal_entries: MigrateKeysEntity[];
}

export interface MigrateKeysRequest {
  encrypted_key_ring: string;
  trees: MigrateKeysTree[];
}

// Trees
export interface TreeCreate {
  encrypted_data: string;
  is_demo?: boolean;
}

export interface TreeUpdate {
  encrypted_data: string;
}

export interface TreeResponse {
  id: string;
  encrypted_data: string;
  is_demo: boolean;
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

// Linked entities (events, life events, turning points, classifications, patterns)
export interface LinkedEntityCreate {
  person_ids: string[];
  encrypted_data: string;
}

export interface LinkedEntityUpdate {
  person_ids?: string[];
  encrypted_data?: string;
}

export interface LinkedEntityResponse {
  id: string;
  person_ids: string[];
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}

export type EventCreate = LinkedEntityCreate;
export type EventUpdate = LinkedEntityUpdate;
export type EventResponse = LinkedEntityResponse;
export type LifeEventCreate = LinkedEntityCreate;
export type LifeEventUpdate = LinkedEntityUpdate;
export type LifeEventResponse = LinkedEntityResponse;
export type TurningPointCreate = LinkedEntityCreate;
export type TurningPointUpdate = LinkedEntityUpdate;
export type TurningPointResponse = LinkedEntityResponse;

// Journal
export interface JournalEntryCreate {
  encrypted_data: string;
}

export interface JournalEntryUpdate {
  encrypted_data: string;
}

export interface JournalEntryResponse {
  id: string;
  encrypted_data: string;
  created_at: string;
  updated_at: string;
}

export type ClassificationCreate = LinkedEntityCreate;
export type ClassificationUpdate = LinkedEntityUpdate;
export type ClassificationResponse = LinkedEntityResponse;
export type PatternCreate = LinkedEntityCreate;
export type PatternUpdate = LinkedEntityUpdate;
export type PatternResponse = LinkedEntityResponse;
export type SiblingGroupCreate = LinkedEntityCreate;
export type SiblingGroupUpdate = LinkedEntityUpdate;
export type SiblingGroupResponse = LinkedEntityResponse;

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
  is_admin: boolean;
  last_active: string | null;
  tree_count: number;
  person_count: number;
  relationship_count: number;
  event_count: number;
}

export interface UserListStats {
  users: UserRow[];
}

// Feedback
export interface FeedbackCreate {
  category: "bug" | "feature" | "general";
  message: string;
  anonymous: boolean;
}

export interface FeedbackItem {
  id: string;
  category: string;
  message: string;
  user_email: string | null;
  created_at: string;
  is_read: boolean;
}

// Waitlist
export interface WaitlistEntry {
  id: string;
  email: string;
  status: string;
  created_at: string;
  approved_at: string | null;
}

export interface WaitlistListResponse {
  items: WaitlistEntry[];
  waiting: number;
  approved: number;
  registered: number;
}

export interface WaitlistCapacity {
  active_users: number;
  max_active_users: number;
  waitlist_enabled: boolean;
}

// Sync: base shapes shared across entity types
interface SyncSimpleCreate {
  id?: string;
  encrypted_data: string;
}

interface SyncSimpleUpdate {
  id: string;
  encrypted_data: string;
}

interface SyncLinkedCreate extends SyncSimpleCreate {
  person_ids: string[];
}

interface SyncLinkedUpdate {
  id: string;
  person_ids?: string[];
  encrypted_data?: string;
}

interface SyncRelationshipCreate extends SyncSimpleCreate {
  source_person_id: string;
  target_person_id: string;
}

interface SyncRelationshipUpdate {
  id: string;
  source_person_id?: string;
  target_person_id?: string;
  encrypted_data?: string;
}

export interface SyncDelete {
  id: string;
}

export interface SyncRequest {
  persons_create?: SyncSimpleCreate[];
  persons_update?: SyncSimpleUpdate[];
  persons_delete?: SyncDelete[];
  relationships_create?: SyncRelationshipCreate[];
  relationships_update?: SyncRelationshipUpdate[];
  relationships_delete?: SyncDelete[];
  events_create?: SyncLinkedCreate[];
  events_update?: SyncLinkedUpdate[];
  events_delete?: SyncDelete[];
  life_events_create?: SyncLinkedCreate[];
  life_events_update?: SyncLinkedUpdate[];
  life_events_delete?: SyncDelete[];
  classifications_create?: SyncLinkedCreate[];
  classifications_update?: SyncLinkedUpdate[];
  classifications_delete?: SyncDelete[];
  turning_points_create?: SyncLinkedCreate[];
  turning_points_update?: SyncLinkedUpdate[];
  turning_points_delete?: SyncDelete[];
  patterns_create?: SyncLinkedCreate[];
  patterns_update?: SyncLinkedUpdate[];
  patterns_delete?: SyncDelete[];
  journal_entries_create?: SyncSimpleCreate[];
  journal_entries_update?: SyncSimpleUpdate[];
  journal_entries_delete?: SyncDelete[];
  sibling_groups_create?: SyncLinkedCreate[];
  sibling_groups_update?: SyncLinkedUpdate[];
  sibling_groups_delete?: SyncDelete[];
}

export interface SyncResponse {
  persons_created: string[];
  relationships_created: string[];
  events_created: string[];
  life_events_created: string[];
  classifications_created: string[];
  turning_points_created: string[];
  patterns_created: string[];
  journal_entries_created: string[];
  persons_updated: number;
  relationships_updated: number;
  events_updated: number;
  life_events_updated: number;
  classifications_updated: number;
  turning_points_updated: number;
  patterns_updated: number;
  journal_entries_updated: number;
  persons_deleted: number;
  relationships_deleted: number;
  events_deleted: number;
  life_events_deleted: number;
  classifications_deleted: number;
  turning_points_deleted: number;
  patterns_deleted: number;
  journal_entries_deleted: number;
  sibling_groups_created: string[];
  sibling_groups_updated: number;
  sibling_groups_deleted: number;
}

// Feature flags
export interface FeatureFlags {
  [key: string]: boolean;
}

export interface AdminFeatureFlag {
  key: string;
  audience: "disabled" | "admins" | "selected" | "all";
  selected_user_ids: string[];
}

export interface AdminFeaturesResponse {
  flags: AdminFeatureFlag[];
}

export interface UpdateFeatureFlagRequest {
  audience: "disabled" | "admins" | "selected" | "all";
  user_ids?: string[];
}
