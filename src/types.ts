/** Shared domain contract. These types are transport-agnostic and contain no Supabase runtime imports. */

export type Id = string;
export type Timestamp = string;
export interface ThemeSettings {
  /** A palette token or validated color value; null means use the catalog/default theme. */
  accentColor: string | null;
  mobileBackgroundImageUrl: string | null;
  desktopBackgroundImageUrl: string | null;
}
export type UnixMilliseconds = number;
export type Points = number;
export type SortOrder = number;

export type Role = 'parent' | 'child' | null;
export type MemberRole = 'parent' | 'child';
export type ChildGender = 'boy' | 'girl';
export type TaskStatus = 'proposed' | 'proposal_revision_requested' | 'todo' | 'pending' | 'revision_requested' | 'completed';
export type TaskCategory = 'life_habit' | 'learning' | 'health' | 'relationship' | 'family_contribution' | 'creativity';
export type TaskOrigin = 'child_proposed' | 'parent_suggested' | 'parent_assigned' | 'system_template';
export type FeedbackTone = 'encouraging' | 'coaching' | 'corrective' | 'correction' | 'celebrating' | 'celebration' | 'celebratory';
export type RedemptionStatus = 'pending' | 'fulfilled' | 'cancelled';
export type PointLedgerEntryType = 'task_approved' | 'reward_redemption' | 'manual_adjustment';
export type AdventureType = 'daily' | 'general';
export type CompletionReportMode = 'none' | 'quick' | 'reflection';
export type AdventureQuickReport = 'smooth' | 'hard' | 'help';
export type AdventureGroupStatus = 'active' | 'archived';
export type TaskTimerStatus = 'running' | 'paused' | 'completed';

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

export interface ProfileViewModel {
  id: Id;
  displayName: string;
  avatarUrl: string | null;
}

export interface FamilyViewModel {
  id: Id;
  name: string;
  members: FamilyMemberViewModel[];
  theme: ThemeSettings;
}

export interface FamilyMemberViewModel {
  id: Id;
  profileId: Id;
  displayName: string;
  role: MemberRole;
}

export interface ChildViewModel {
  id: Id;
  familyId: Id;
  profileId: Id | null;
  loginName: string | null;
  name: string;
  gender: ChildGender;
  characterId: string;
  joinedAt: Timestamp;
  joinedDays: number;
  points: Points;
  theme: ThemeSettings;
}

export interface TaskTemplateViewModel {
  id: Id;
  name: string;
  points: Points;
  duration: number | null;
  icon: string;
  category: TaskCategory;
  suggestedEvidence: string;
  dueTime: string | null;
  endTime: string | null;
  requiresReviewBeforeNextTask: boolean;
}

export interface TaskViewModel {
  id: Id;
  familyId: Id;
  childProfileId: Id;
  name: string;
  points: Points;
  status: TaskStatus;
  icon: string;
  duration: number | null;
  timerEndTime: UnixMilliseconds | null;
  timerRemainingMs: UnixMilliseconds | null;
  timerIsRunning: boolean;
  isDaily: boolean;
  templateId: Id | null;
  dueOn: string | null;
  dueTime: string | null;
  endTime: string | null;
  requiresReviewBeforeNextTask: boolean;
  category: TaskCategory;
  origin: TaskOrigin;
  originalName: string | null;
  originalPoints: Points | null;
  confirmedAt: Timestamp | null;
  confirmedBy: Id | null;
  submittedAt: Timestamp | null;
  reviewedAt: Timestamp | null;
  reviewedBy: Id | null;
  approvedPoints: Points | null;
  reflection: string | null;
  mood: string | null;
  difficulty: number | null;
  parentFeedback: string | null;
  parentCorrection: string | null;
  feedbackTone: FeedbackTone | null;
  revisionNote: string | null;
  completedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  description?: string | null;
  adventureType?: AdventureType;
  adventureGroupId?: Id | null;
  scheduleId?: Id | null;
  occurrenceDate?: string | null;
  completionReportMode?: CompletionReportMode;
  quickReport?: AdventureQuickReport | null;
  requiresTimer?: boolean;
  /** True only while an offline completion is queued for server validation. */
  pendingSync?: boolean;
}

export interface AdventureGroup {
  id: Id;
  familyId: Id;
  childProfileId: Id;
  type: 'general';
  title: string;
  status: AdventureGroupStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  archivedAt: Timestamp | null;
}

export interface TaskSchedule {
  id: Id;
  familyId: Id;
  childProfileId: Id;
  name: string;
  description: string | null;
  points: Points;
  icon: string;
  category: TaskCategory;
  durationMinutes: number | null;
  startTime: string | null;
  endTime: string | null;
  weekdays: number[];
  timezone: string;
  requiresTimer: boolean;
  requiresReviewBeforeNextTask: boolean;
  activeFrom: string;
  activeUntil: string | null;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TaskTimerSession {
  id: Id;
  familyId: Id;
  childProfileId: Id;
  taskId: Id;
  status: TaskTimerStatus;
  accumulatedSeconds: number;
  startedAt: Timestamp;
  lastResumedAt: Timestamp | null;
  pausedAt: Timestamp | null;
  completedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RewardViewModel {
  id: Id;
  name: string;
  points: Points;
  icon: string;
}

export interface WishlistItemViewModel {
  id: Id;
  name: string;
}

export interface RewardRedemptionViewModel {
  id: Id;
  rewardId: Id;
  rewardName: string;
  rewardIcon: string;
  pointsCost: Points;
  status: RedemptionStatus;
  createdAt: UnixMilliseconds;
}

export interface PointLedgerViewModel {
  id: Id;
  childProfileId: Id;
  pointsDelta: Points;
  entryType: PointLedgerEntryType;
  note: string | null;
  createdAt: UnixMilliseconds;
}

// Legacy localStorage view types. Keep these aliases until the storage adapter is replaced.
export interface TaskTemplate extends Omit<TaskTemplateViewModel, 'duration' | 'category' | 'suggestedEvidence' | 'dueTime' | 'endTime' | 'requiresReviewBeforeNextTask'> {
  duration?: number;
  category?: TaskCategory;
  suggestedEvidence?: string;
  dueTime?: string | null;
  endTime?: string | null;
  requiresReviewBeforeNextTask?: boolean;
}
export interface Task extends Omit<
  TaskViewModel,
  | 'familyId'
  | 'childProfileId'
  | 'duration'
  | 'timerEndTime'
  | 'timerRemainingMs'
  | 'timerIsRunning'
  | 'templateId'
  | 'dueOn'
  | 'dueTime'
  | 'endTime'
  | 'requiresReviewBeforeNextTask'
  | 'category'
  | 'origin'
  | 'originalName'
  | 'originalPoints'
  | 'confirmedAt'
  | 'confirmedBy'
  | 'submittedAt'
  | 'reviewedAt'
  | 'reviewedBy'
  | 'approvedPoints'
  | 'reflection'
  | 'mood'
  | 'difficulty'
  | 'parentFeedback'
  | 'parentCorrection'
  | 'feedbackTone'
  | 'revisionNote'
  | 'completedAt'
  | 'createdAt'
  | 'updatedAt'
> {
  duration?: number;
  timerEndTime?: UnixMilliseconds | null;
  timerRemainingMs?: UnixMilliseconds | null;
  timerIsRunning?: boolean;
  templateId?: Id | null;
  dueOn?: string | null;
  dueTime?: string | null;
  endTime?: string | null;
  requiresReviewBeforeNextTask?: boolean;
  category?: TaskCategory;
  origin?: TaskOrigin;
  originalName?: string | null;
  originalPoints?: Points | null;
  confirmedAt?: Timestamp | null;
  confirmedBy?: Id | null;
  submittedAt?: Timestamp | null;
  reviewedAt?: Timestamp | null;
  reviewedBy?: Id | null;
  approvedPoints?: Points | null;
  reflection?: string | null;
  mood?: string | null;
  difficulty?: number | null;
  parentFeedback?: string | null;
  parentCorrection?: string | null;
  feedbackTone?: FeedbackTone | string | null;
  revisionNote?: string | null;
  completedAt?: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
export type Reward = RewardViewModel;
export type WishlistItem = WishlistItemViewModel;
export interface Ticket extends Omit<RewardRedemptionViewModel, 'pointsCost' | 'status'> {
  status: 'pending' | 'fulfilled';
  createdAt: UnixMilliseconds;
}
export interface Child {
  id: Id;
  name: string;
  characterId: string;
  code: string;
  loginName: string | null;
  points: Points;
  tasks: Task[];
  rewards: Reward[];
  wishlist: WishlistItem[];
  tickets: Ticket[];
  theme: ThemeSettings;
}

export interface AppState {
  parentPin: string | null;
  parentConsentVersion: string | null;
  children: Child[];
  parentActiveChildId: Id | null;
  childLoggedInId: Id | null;
  taskTemplates: TaskTemplate[];
  ledger: PointLedgerViewModel[];
  lastResetDate: string | null;
  familyTheme: ThemeSettings;
  adventureGroups?: AdventureGroup[];
  taskSchedules?: TaskSchedule[];
  timerSessions?: TaskTimerSession[];
}
