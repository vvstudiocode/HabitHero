import type {
  CoopAdventureCompletion,
  CoopAdventureParticipant,
  CoopAdventureState,
  CoopAdventureSummary,
  CoopCompletionSummary,
} from './contracts';

export function createInitialCoopAdventureState(): CoopAdventureState {
  return {
    adventures: [],
    participants: [],
    completions: [],
    lastSyncedAt: null,
  };
}

export function mergeCoopAdventureState(
  current: CoopAdventureState,
  incoming: CoopAdventureState,
): CoopAdventureState {
  return {
    adventures: mergeById(current.adventures, incoming.adventures),
    participants: mergeById(current.participants, incoming.participants),
    completions: mergeById(current.completions, incoming.completions),
    lastSyncedAt: incoming.lastSyncedAt ?? current.lastSyncedAt,
  };
}

export function buildCoopCompletionSummary(
  state: CoopAdventureState,
  adventureId: string,
): CoopCompletionSummary | null {
  const adventure = state.adventures.find(({ id }) => id === adventureId);
  if (!adventure) return null;

  const participants = state.participants.filter(({ coopAdventureId }) => coopAdventureId === adventureId);
  const participantIds = new Set(participants.map(({ id }) => id));
  const completions = state.completions.filter(({ coopAdventureId, participantId }) => (
    coopAdventureId === adventureId && participantIds.has(participantId)
  ));

  return {
    adventureId,
    title: adventure.title,
    status: adventure.status,
    participants,
    completions,
  };
}

export function upsertCoopAdventure(
  state: CoopAdventureState,
  adventure: CoopAdventureSummary,
): CoopAdventureState {
  return {
    ...state,
    adventures: mergeById(state.adventures, [adventure]),
  };
}

function mergeById<T extends { id: string }>(current: readonly T[], incoming: readonly T[]): T[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => byId.set(item.id, item));
  return [...byId.values()];
}

export type CoopStateParticipant = CoopAdventureParticipant;
export type CoopStateCompletion = CoopAdventureCompletion;
