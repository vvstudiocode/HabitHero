export const COOP_ADVENTURE_KIND = 'general' as const;
export const COOP_ADVENTURE_EVENT = 'coop_changed_v1' as const;
export const COOP_ADVENTURE_NOTIFICATION_TYPE = 'coop_adventure_created' as const;

export type CoopAdventureStatus = 'active' | 'completed' | 'cancelled';
export type CoopParticipantRole = 'creator' | 'participant';
export type CoopCompletionStatus = 'pending' | 'completed' | 'revision_requested';
export type CoopQuickReport = 'smooth' | 'hard' | 'help';

export interface CoopAdventureSummary {
  id: string;
  worldOwnerChildProfileId: string;
  title: string;
  description?: string | null;
  status: CoopAdventureStatus;
  participantCount: number;
  createdAt: string;
  completedAt?: string | null;
}

export interface CoopAdventureParticipant {
  id: string;
  coopAdventureId: string;
  childProfileId: string;
  displayName: string;
  role: CoopParticipantRole;
  joinedAt: string;
}

export interface CoopAdventureCompletion {
  id: string;
  coopAdventureId: string;
  participantId: string;
  status: CoopCompletionStatus;
  submittedAt: string | null;
  reviewedAt?: string | null;
}

/** Internal references stay in the relation tables, never in public task rows. */
export interface CoopParticipantTaskReference {
  participantId: string;
  taskId: string;
  completionId: string | null;
}

export interface CoopAdventureState {
  adventures: CoopAdventureSummary[];
  participants: CoopAdventureParticipant[];
  completions: CoopAdventureCompletion[];
  lastSyncedAt: string | null;
}

export interface CoopCompletionSummary {
  adventureId: string;
  title: string;
  status: CoopAdventureStatus;
  participants: CoopAdventureParticipant[];
  completions: CoopAdventureCompletion[];
}

export interface CoopAdventureNotification {
  version: 1;
  event: typeof COOP_ADVENTURE_EVENT;
  type: typeof COOP_ADVENTURE_NOTIFICATION_TYPE;
  coopAdventureId: string;
  worldOwnerChildProfileId: string;
  creatorChildProfileId: string;
  title: string;
  createdAt: string;
}

export interface CreateCoopAdventureInput {
  taskId: string;
}

export interface CoopCompletionInput {
  idempotencyKey: string;
  quickReport?: CoopQuickReport | null;
  reflection?: string | null;
  mood?: string | null;
  difficulty?: number | null;
}

export interface CoopReviewInput {
  approved: boolean;
  approvedPoints?: number | null;
  feedback?: string | null;
  correction?: string | null;
  tone?: string | null;
  revisionNote?: string | null;
}

export interface CoopMutationResult {
  coopAdventureId: string;
  participantId?: string;
  completionId?: string;
  status: CoopCompletionStatus | 'joined' | 'created';
}

export function getCoopWorldTopic(worldOwnerChildProfileId: string): string {
  return `friend-world:${worldOwnerChildProfileId}`;
}

export function isGeneralAdventure(
  task: { adventureType?: string | null; isDaily?: boolean | null },
): boolean {
  return task.adventureType === COOP_ADVENTURE_KIND && task.isDaily === false;
}

export function makeCoopAdventureNotification(input: Omit<CoopAdventureNotification, 'version' | 'event' | 'type'>): CoopAdventureNotification {
  return {
    version: 1,
    event: COOP_ADVENTURE_EVENT,
    type: COOP_ADVENTURE_NOTIFICATION_TYPE,
    ...input,
  };
}
