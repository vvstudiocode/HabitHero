import type { FeedbackTone as AppFeedbackTone, Task, TaskTemplate, TaskCategory as AppTaskCategory, TaskOrigin as AppTaskOrigin } from '../../types';

export type GrowthTaskStatus = 'proposed' | 'proposal_revision_requested' | 'todo' | 'pending' | 'revision_requested' | 'completed';
export type TaskCategory = AppTaskCategory;
export type TaskOrigin = AppTaskOrigin;
export type FeedbackTone = Extract<AppFeedbackTone, 'encouraging' | 'coaching' | 'corrective' | 'celebratory'>;
export type GrowthMood = 'proud' | 'happy' | 'calm' | 'okay' | 'tired' | 'frustrated';

export interface GrowthTask extends Omit<Task, 'status'> {
  status: GrowthTaskStatus;
  category?: TaskCategory;
  origin?: TaskOrigin;
  originalName?: string | null;
  originalPoints?: number | null;
  confirmedAt?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  approvedPoints?: number | null;
  reflection?: string | null;
  mood?: GrowthMood | string | null;
  difficulty?: number | null;
  parentFeedback?: string | null;
  parentCorrection?: string | null;
  childReflectionText?: string | null;
  childMood?: GrowthMood | string | null;
  childDifficulty?: number | null;
  parentFeedbackText?: string | null;
  parentCorrectionText?: string | null;
  feedbackTone?: FeedbackTone | string | null;
  revisionNote?: string | null;
}

export interface GrowthTaskWithChild extends GrowthTask {
  childId: string;
  childName: string;
}

export interface GrowthTaskTemplate extends TaskTemplate {
  category?: TaskCategory;
  suggestedEvidence?: string;
}

export interface GoalProposalInput {
  name: string;
  points: number;
  category: TaskCategory;
  dueTime: string;
}

export interface GoalConfirmationInput {
  name: string;
  points: number;
  category: TaskCategory;
}

export interface GoalReflectionInput {
  reflection: string;
  mood: GrowthMood;
  difficulty: number;
}

export interface GoalReviewInput {
  approved: boolean;
  approvedPoints: number;
  feedback: string;
  correction: string;
  tone: FeedbackTone | null;
  revisionNote: string;
}
