import type {
  ChildGender,
  FeedbackTone,
  Id,
  MemberRole,
  PointLedgerEntryType,
  Points,
  RedemptionStatus,
  SortOrder,
  TaskCategory,
  TaskOrigin,
  TaskStatus,
  Timestamp,
} from './primitives';

export interface ProfileCreateInput {
  id: Id;
  display_name: string;
  avatar_url?: string | null;
}

export interface ProfileUpdateInput {
  display_name?: string;
  avatar_url?: string | null;
}

export interface FamilyCreateInput {
  name: string;
  created_by: Id;
}

export interface FamilyUpdateInput {
  name?: string;
  accent_color?: string;
  background_image_mobile_url?: string | null;
  background_image_desktop_url?: string | null;
}

export interface FamilyMemberCreateInput {
  family_id: Id;
  profile_id: Id;
  role: MemberRole;
}

export interface FamilyMemberUpdateInput {
  role?: MemberRole;
}

export interface ChildProfileCreateInput {
  family_id: Id;
  profile_id: Id | null;
  display_name: string;
  gender: ChildGender;
  character_id: string;
  joined_at?: Timestamp;
  points_balance?: Points;
}

export interface ChildProfileUpdateInput {
  points_balance?: Points;
  accent_color?: string | null;
  background_image_mobile_url?: string | null;
  background_image_desktop_url?: string | null;
}

export interface TaskTemplateCreateInput {
  family_id: Id;
  name: string;
  points: Points;
  duration_minutes?: number | null;
  icon: string;
  sort_order?: SortOrder;
  category?: TaskCategory;
  suggested_evidence?: string;
  due_time?: string | null;
  end_time?: string | null;
}

export interface TaskTemplateUpdateInput {
  name?: string;
  points?: Points;
  duration_minutes?: number | null;
  icon?: string;
  sort_order?: SortOrder;
  category?: TaskCategory;
  suggested_evidence?: string;
  due_time?: string | null;
  end_time?: string | null;
}

export interface TaskCreateInput {
  family_id: Id;
  child_profile_id: Id;
  template_id?: Id | null;
  name: string;
  points: Points;
  icon: string;
  duration_minutes?: number | null;
  is_daily?: boolean;
  due_on?: string | null;
  due_time?: string | null;
  end_time?: string | null;
  category?: TaskCategory;
  origin?: TaskOrigin;
  reflection?: string | null;
  mood?: string | null;
  difficulty?: number | null;
}

export interface TaskUpdateInput {
  name?: string;
  points?: Points;
  status?: TaskStatus;
  icon?: string;
  duration_minutes?: number | null;
  is_daily?: boolean;
  due_on?: string | null;
  category?: TaskCategory;
  origin?: TaskOrigin;
  approved_points?: Points | null;
  child_reflection_text?: string | null;
  child_mood?: string | null;
  child_difficulty?: number | null;
  parent_feedback_text?: string | null;
  parent_correction_text?: string | null;
  feedback_tone?: FeedbackTone | null;
  revision_note?: string | null;
  completed_at?: Timestamp | null;
}

export interface RewardCreateInput {
  family_id: Id;
  child_profile_id: Id;
  name: string;
  points: Points;
  icon: string;
  sort_order?: SortOrder;
}

export interface RewardUpdateInput {
  name?: string;
  points?: Points;
  icon?: string;
  sort_order?: SortOrder;
}

export interface WishlistItemCreateInput {
  family_id: Id;
  child_profile_id: Id;
  name: string;
}

export interface WishlistItemUpdateInput {
  name?: string;
}

export interface RewardRedemptionCreateInput {
  family_id: Id;
  child_profile_id: Id;
  reward_id: Id;
  points_cost: Points;
}

export interface RewardRedemptionUpdateInput {
  status?: RedemptionStatus;
  fulfilled_at?: Timestamp | null;
}

/** Ledger entries are created by a trusted mutation and never by editing a balance in the UI. */
export interface PointLedgerCreateInput {
  family_id: Id;
  child_profile_id: Id;
  task_id?: Id | null;
  redemption_id?: Id | null;
  entry_type: PointLedgerEntryType;
  points_delta: Points;
  note?: string | null;
}
