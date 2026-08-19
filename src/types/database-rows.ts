import type {
  AdventureGroupStatus,
  AdventureQuickReport,
  AdventureType,
  ChildGender,
  CompletionReportMode,
  FeedbackTone,
  Id,
  MemberRole,
  PointLedgerEntryType,
  Points,
  RedemptionStatus,
  SortOrder,
  TaskCancellationActor,
  TaskCategory,
  TaskOrigin,
  TaskStatus,
  TaskTimerStatus,
  Timestamp,
} from './primitives';

export interface ProfileRow {
  id: Id;
  display_name: string;
  avatar_url: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface FamilyRow {
  id: Id;
  name: string;
  created_by: Id;
  created_at: Timestamp;
  updated_at: Timestamp;
  accent_color?: string;
  background_image_mobile_url?: string | null;
  background_image_desktop_url?: string | null;
}

export interface FamilyMemberRow {
  id: Id;
  family_id: Id;
  profile_id: Id;
  role: MemberRole;
  created_at: Timestamp;
}

/** A child profile has exactly one family owner. A child can have only one row in this table. */
export interface ChildProfileRow {
  id: Id;
  family_id: Id;
  profile_id: Id | null;
  login_name: string | null;
  display_name: string;
  gender: ChildGender;
  character_id: string;
  joined_at: Timestamp;
  points_balance: Points;
  created_at: Timestamp;
  updated_at: Timestamp;
  accent_color?: string | null;
  background_image_mobile_url?: string | null;
  background_image_desktop_url?: string | null;
}

export interface TaskTemplateRow {
  id: Id;
  family_id: Id;
  name: string;
  points: Points;
  duration_minutes: number | null;
  icon: string;
  sort_order: SortOrder;
  category: TaskCategory;
  suggested_evidence: string;
  due_time: string | null;
  end_time: string | null;
  requires_review_before_next_task?: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface TaskRow {
  id: Id;
  family_id: Id;
  child_profile_id: Id;
  template_id: Id | null;
  name: string;
  points: Points;
  status: TaskStatus;
  icon: string;
  duration_minutes: number | null;
  is_daily: boolean;
  due_on: string | null;
  due_time: string | null;
  end_time: string | null;
  requires_review_before_next_task?: boolean;
  category: TaskCategory;
  origin: TaskOrigin;
  original_name: string | null;
  original_points: Points | null;
  confirmed_at: Timestamp | null;
  confirmed_by: Id | null;
  submitted_at: Timestamp | null;
  reviewed_at: Timestamp | null;
  reviewed_by: Id | null;
  approved_points: Points | null;
  child_reflection_text: string | null;
  child_mood: string | null;
  child_difficulty: number | null;
  parent_feedback_text: string | null;
  parent_correction_text: string | null;
  feedback_tone: FeedbackTone | null;
  revision_note: string | null;
  completed_at: Timestamp | null;
  cancelled_at?: Timestamp | null;
  cancelled_by?: TaskCancellationActor | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  description?: string | null;
  adventure_type?: AdventureType;
  adventure_group_id?: Id | null;
  schedule_id?: Id | null;
  occurrence_date?: string | null;
  completion_report_mode?: CompletionReportMode;
  quick_report?: AdventureQuickReport | null;
  requires_timer?: boolean;
}

export interface AdventureGroupRow {
  id: Id;
  family_id: Id;
  child_profile_id: Id;
  type: 'general';
  title: string;
  status: AdventureGroupStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
  archived_at: Timestamp | null;
}

export interface TaskScheduleRow {
  id: Id;
  family_id: Id;
  child_profile_id: Id;
  name: string;
  description: string | null;
  points: Points;
  icon: string;
  category: TaskCategory;
  duration_minutes: number | null;
  start_time: string | null;
  end_time: string | null;
  weekdays: number[];
  timezone: string;
  requires_timer: boolean;
  requires_review_before_next_task: boolean;
  active_from: string;
  active_until: string | null;
  is_active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface TaskTimerSessionRow {
  id: Id;
  family_id: Id;
  child_profile_id: Id;
  task_id: Id;
  status: TaskTimerStatus;
  accumulated_seconds: number;
  started_at: Timestamp;
  last_resumed_at: Timestamp | null;
  paused_at: Timestamp | null;
  completed_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RewardRow {
  id: Id;
  family_id: Id;
  child_profile_id: Id;
  name: string;
  points: Points;
  icon: string;
  sort_order: SortOrder;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface WishlistItemRow {
  id: Id;
  family_id: Id;
  child_profile_id: Id;
  name: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RewardRedemptionRow {
  id: Id;
  family_id: Id;
  child_profile_id: Id;
  reward_id: Id;
  reward_name: string;
  reward_icon: string;
  points_cost: Points;
  status: RedemptionStatus;
  created_at: Timestamp;
  fulfilled_at: Timestamp | null;
}

export interface PointLedgerRow {
  id: Id;
  family_id: Id;
  child_profile_id: Id;
  task_id: Id | null;
  redemption_id: Id | null;
  entry_type: PointLedgerEntryType;
  points_delta: Points;
  note: string | null;
  created_at: Timestamp;
}
