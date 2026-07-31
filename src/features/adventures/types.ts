import type { GrowthTask, GrowthTaskStatus } from '../growth/types';

export type AdventureType = 'daily' | 'general';
export type CompletionReportMode = 'none' | 'quick' | 'reflection';
export type QuickAdventureReport = 'smooth' | 'hard' | 'help';

export interface AdventureTask extends GrowthTask {
  adventureType?: AdventureType;
  adventureGroupId?: string | null;
  scheduleId?: string | null;
  occurrenceDate?: string | null;
  completionReportMode?: CompletionReportMode;
  description?: string | null;
  pendingSync?: boolean;
}

export interface AdventureProgress {
  completed: number;
  total: number;
}

export type AdventureTaskVisualState =
  | 'available'
  | 'waiting'
  | 'syncing'
  | 'submitted'
  | 'completed'
  | 'revision';

export interface AdventureCompletionInput {
  idempotencyKey: string;
  quickReport?: QuickAdventureReport;
  reflection?: string;
  mood?: string;
  difficulty?: number;
}

export interface AdventureCompletionPayload extends AdventureCompletionInput {
  taskId: string;
}

export const ADVENTURE_ACTIVE_STATUSES: readonly GrowthTaskStatus[] = [
  'proposed',
  'proposal_revision_requested',
  'todo',
  'pending',
  'revision_requested',
  'completed',
];
