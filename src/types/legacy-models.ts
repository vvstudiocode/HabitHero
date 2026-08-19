import type { ChildGameData } from '../features/world/contracts';
import type {
  FeedbackTone,
  Id,
  Points,
  TaskCancellationActor,
  TaskCategory,
  TaskOrigin,
  ThemeSettings,
  Timestamp,
  UnixMilliseconds,
} from './primitives';
import type {
  PointLedgerViewModel,
  RewardRedemptionViewModel,
  TaskTemplateViewModel,
  TaskViewModel,
} from './view-models';

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
  cancelledAt?: Timestamp | null;
  cancelledBy?: TaskCancellationActor | null;
  completedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type Reward = import('./view-models').RewardViewModel;
export type WishlistItem = import('./view-models').WishlistItemViewModel;

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
  adventureGroups?: import('./view-models').AdventureGroup[];
  taskSchedules?: import('./view-models').TaskSchedule[];
  timerSessions?: import('./view-models').TaskTimerSession[];
  gameDataByChildId: Record<Id, ChildGameData>;
}
