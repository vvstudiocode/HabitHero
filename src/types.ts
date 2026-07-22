/** Shared domain contract. These types are transport-agnostic and contain no Supabase runtime imports. */

export type Id = string;
export type Timestamp = string;
export type UnixMilliseconds = number;
export type Points = number;
export type SortOrder = number;

export type Role = 'parent' | 'child' | null;
export type MemberRole = 'parent' | 'child';
export type TaskStatus = 'proposed' | 'proposal_revision_requested' | 'todo' | 'pending' | 'revision_requested' | 'completed';
export type TaskCategory = 'life_habit' | 'learning' | 'health' | 'relationship' | 'family_contribution' | 'creativity';
export type TaskOrigin = 'child_proposed' | 'parent_suggested' | 'parent_assigned' | 'system_template';
export type FeedbackTone = 'encouraging' | 'coaching' | 'corrective' | 'correction' | 'celebrating' | 'celebration' | 'celebratory';
export type RedemptionStatus = 'pending' | 'fulfilled' | 'cancelled';
export type PointLedgerEntryType = 'task_approved' | 'reward_redemption' | 'manual_adjustment';

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
  points_balance: Points;
  created_at: Timestamp;
  updated_at: Timestamp;
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
  profile_id: Id;
  points_balance?: Points;
}
export interface ChildProfileUpdateInput {
  points_balance?: Points;
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
}
export interface TaskTemplateUpdateInput {
  name?: string;
  points?: Points;
  duration_minutes?: number | null;
  icon?: string;
  sort_order?: SortOrder;
  category?: TaskCategory;
  suggested_evidence?: string;
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
  points: Points;
}

export interface TaskTemplateViewModel {
  id: Id;
  name: string;
  points: Points;
  duration: number | null;
  icon: string;
  category: TaskCategory;
  suggestedEvidence: string;
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
export interface TaskTemplate extends Omit<TaskTemplateViewModel, 'duration' | 'category' | 'suggestedEvidence'> {
  duration?: number;
  category?: TaskCategory;
  suggestedEvidence?: string;
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
  code: string;
  loginName: string | null;
  points: Points;
  tasks: Task[];
  rewards: Reward[];
  wishlist: WishlistItem[];
  tickets: Ticket[];
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
}
