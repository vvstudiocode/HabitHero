import type { SupabaseClient } from '@supabase/supabase-js';
import {
  COOP_ADVENTURE_EVENT,
  getCoopWorldTopic,
  makeCoopAdventureNotification,
  type CoopAdventureCompletion,
  type CoopAdventureNotification,
  type CoopAdventureParticipant,
  type CoopAdventureState,
  type CoopAdventureSummary,
  type CoopCompletionInput,
  type CoopMutationResult,
  type CoopReviewInput,
} from '../../features/co-op-adventures/contracts';

export interface CoopAdventureRepository {
  list(worldOwnerChildProfileId: string): Promise<CoopAdventureSummary[]>;
  loadState(adventureId: string): Promise<CoopAdventureState>;
  createFromGeneralTask(taskId: string): Promise<CoopAdventureNotification>;
  join(adventureId: string): Promise<CoopMutationResult>;
  submitCompletion(participantId: string, input: CoopCompletionInput): Promise<CoopMutationResult>;
  reviewCompletion(participantId: string, input: CoopReviewInput): Promise<CoopMutationResult>;
  subscribe(worldOwnerChildProfileId: string, onChange: () => void): () => void;
}

export function createCoopAdventureRepository(client: SupabaseClient): CoopAdventureRepository {
  return {
    list: (worldOwnerChildProfileId) => listCoopAdventures(client, worldOwnerChildProfileId),
    loadState: (adventureId) => loadCoopAdventureState(client, adventureId),
    createFromGeneralTask: (taskId) => createCoopAdventure(client, taskId),
    join: (adventureId) => joinCoopAdventure(client, adventureId),
    submitCompletion: (participantId, input) => submitCoopCompletion(client, participantId, input),
    reviewCompletion: (participantId, input) => reviewCoopCompletion(client, participantId, input),
  subscribe: (worldOwnerChildProfileId, onChange) => subscribeToCoopAdventureChanges(client, worldOwnerChildProfileId, onChange),
  };
}

async function listCoopAdventures(client: SupabaseClient, worldOwnerChildProfileId: string): Promise<CoopAdventureSummary[]> {
  const result = await client.rpc('list_coop_adventures', {
    target_world_owner_child_profile_id: worldOwnerChildProfileId,
  });
  return mapRows<CoopAdventureSummary>(result, mapAdventure);
}

async function loadCoopAdventureState(client: SupabaseClient, adventureId: string): Promise<CoopAdventureState> {
  const result = await client.rpc('get_coop_adventure_state', {
    target_coop_adventure_id: adventureId,
  });
  const payload = requireData(result) as Record<string, unknown>;
  return {
    adventures: mapRowsFromValue(payload.adventures, mapAdventure),
    participants: mapRowsFromValue(payload.participants, mapParticipant),
    completions: mapRowsFromValue(payload.completions, mapCompletion),
    lastSyncedAt: typeof payload.synced_at === 'string' ? payload.synced_at : new Date().toISOString(),
  };
}

async function createCoopAdventure(client: SupabaseClient, taskId: string): Promise<CoopAdventureNotification> {
  const result = await client.rpc('create_coop_adventure', { target_task_id: taskId });
  const row = requireData(result) as Record<string, unknown>;
  return makeCoopAdventureNotification({
    coopAdventureId: stringValue(row.coop_adventure_id),
    worldOwnerChildProfileId: stringValue(row.world_owner_child_profile_id),
    creatorChildProfileId: stringValue(row.creator_child_profile_id),
    title: stringValue(row.title),
    createdAt: stringValue(row.created_at),
  });
}

async function joinCoopAdventure(client: SupabaseClient, adventureId: string): Promise<CoopMutationResult> {
  const result = await client.rpc('join_coop_adventure', {
    target_coop_adventure_id: adventureId,
  });
  return mapMutationResult(requireData(result));
}

async function submitCoopCompletion(
  client: SupabaseClient,
  participantId: string,
  input: CoopCompletionInput,
): Promise<CoopMutationResult> {
  const result = await client.rpc('submit_coop_adventure_completion', {
    target_participant_id: participantId,
    idempotency_key: input.idempotencyKey,
    quick_report: input.quickReport ?? null,
    reflection: input.reflection ?? null,
    mood: input.mood ?? null,
    difficulty: input.difficulty ?? null,
  });
  return mapMutationResult(requireData(result));
}

async function reviewCoopCompletion(
  client: SupabaseClient,
  participantId: string,
  input: CoopReviewInput,
): Promise<CoopMutationResult> {
  const result = await client.rpc('review_coop_adventure_completion', {
    target_participant_id: participantId,
    approved: input.approved,
    approved_points: input.approvedPoints ?? null,
    feedback: input.feedback ?? null,
    correction: input.correction ?? null,
    tone: input.tone ?? null,
    revision_note: input.revisionNote ?? null,
  });
  return mapMutationResult(requireData(result));
}

function subscribeToCoopAdventureChanges(
  client: SupabaseClient,
  worldOwnerChildProfileId: string,
  onChange: () => void,
): () => void {
  const realtime = (client as unknown as { realtime?: { setAuth?: () => Promise<unknown> } }).realtime;
  void realtime?.setAuth?.();
  const channel = client
    .channel(getCoopWorldTopic(worldOwnerChildProfileId), { config: { private: true } })
    .on('broadcast', { event: COOP_ADVENTURE_EVENT }, (payload) => {
      const raw = (payload as { payload?: unknown }).payload ?? payload;
      if (isRecord(raw) && raw.event === COOP_ADVENTURE_EVENT) onChange();
    });
  channel.subscribe();
  return () => { void client.removeChannel(channel); };
}

function mapAdventure(value: unknown): CoopAdventureSummary {
  const row = asRecord(value);
  return {
    id: stringValue(row.id ?? row.coop_adventure_id),
    worldOwnerChildProfileId: stringValue(row.world_owner_child_profile_id),
    title: stringValue(row.title),
    description: nullableString(row.description),
    status: (row.status as CoopAdventureSummary['status']) ?? 'active',
    participantCount: numberValue(row.participant_count),
    createdAt: stringValue(row.created_at),
    completedAt: nullableString(row.completed_at),
  };
}

function mapParticipant(value: unknown): CoopAdventureParticipant {
  const row = asRecord(value);
  return {
    id: stringValue(row.id ?? row.participant_id),
    coopAdventureId: stringValue(row.coop_adventure_id),
    childProfileId: stringValue(row.child_profile_id),
    displayName: stringValue(row.display_name),
    role: (row.role as CoopAdventureParticipant['role']) ?? 'participant',
    joinedAt: stringValue(row.joined_at),
  };
}

function mapCompletion(value: unknown): CoopAdventureCompletion {
  const row = asRecord(value);
  return {
    id: stringValue(row.id ?? row.completion_id),
    coopAdventureId: stringValue(row.coop_adventure_id),
    participantId: stringValue(row.participant_id),
    status: (row.status as CoopAdventureCompletion['status']) ?? 'pending',
    submittedAt: nullableString(row.submitted_at),
    reviewedAt: nullableString(row.reviewed_at),
  };
}

function mapMutationResult(value: unknown): CoopMutationResult {
  const row = asRecord(value);
  return {
    coopAdventureId: stringValue(row.coop_adventure_id),
    participantId: optionalString(row.participant_id),
    completionId: optionalString(row.completion_id),
    status: (row.status as CoopMutationResult['status']) ?? 'joined',
  };
}

function mapRows<T>(result: { data: unknown; error: { message: string } | null }, mapper: (value: unknown) => T): T[] {
  return mapRowsFromValue(requireData(result), mapper);
}

function mapRowsFromValue<T>(value: unknown, mapper: (value: unknown) => T): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(mapper);
}

function requireData(result: { data: unknown; error: { message: string } | null }): unknown {
  if (result.error) throw new Error('合作冒險同步失敗。');
  return result.data;
}

function asRecord(value: unknown): Record<string, any> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
