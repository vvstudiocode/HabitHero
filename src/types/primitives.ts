/** Shared scalar and value-object contracts used by database, domain, and UI types. */

export type Id = string;
export type Timestamp = string;
export type UnixMilliseconds = number;
export type Points = number;
export type SortOrder = number;

export interface ThemeSettings {
  /** A palette token or validated color value; null means use the catalog/default theme. */
  accentColor: string | null;
  mobileBackgroundImageUrl: string | null;
  desktopBackgroundImageUrl: string | null;
}

export type Role = 'parent' | 'child' | null;
export type MemberRole = 'parent' | 'child';
export type ChildGender = 'boy' | 'girl';
export type TaskStatus =
  | 'proposed'
  | 'proposal_revision_requested'
  | 'todo'
  | 'pending'
  | 'revision_requested'
  | 'completed'
  | 'cancelled';
export type TaskCancellationActor = 'child' | 'parent';
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
