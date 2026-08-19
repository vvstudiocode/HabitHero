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
  TaskCancellationActor,
  TaskCategory,
  TaskOrigin,
  TaskStatus,
  TaskTimerStatus,
  ThemeSettings,
  Timestamp,
  UnixMilliseconds,
} from './primitives';

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
  cancelledAt?: Timestamp | null;
  cancelledBy?: TaskCancellationActor | null;
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
  taskId: Id | null;
  pointsDelta: Points;
  entryType: PointLedgerEntryType;
  note: string | null;
  createdAt: UnixMilliseconds;
}

export interface PointLedgerPage {
  entries: PointLedgerViewModel[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface PointLedgerAdjustmentResult {
  ledgerEntry: PointLedgerViewModel;
  pointsBalance: Points;
}
