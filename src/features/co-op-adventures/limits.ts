export const COOP_ACTIVE_ADVENTURES_PER_WORLD = 5;
export const COOP_PARTICIPANTS_PER_ADVENTURE = 8;

export function canCreateCoopAdventure(activeAdventureCount: number): boolean {
  return Number.isInteger(activeAdventureCount)
    && activeAdventureCount >= 0
    && activeAdventureCount < COOP_ACTIVE_ADVENTURES_PER_WORLD;
}

export function canAcceptCoopParticipant(participantCount: number): boolean {
  return Number.isInteger(participantCount)
    && participantCount >= 0
    && participantCount < COOP_PARTICIPANTS_PER_ADVENTURE;
}

export function getCoopRemainingParticipantSlots(participantCount: number): number {
  return Math.max(0, COOP_PARTICIPANTS_PER_ADVENTURE - Math.max(0, participantCount));
}
