export const PARENT_IDLE_LOCK_MS = 3 * 60 * 1000;

export function isParentModeUnlocked(unlockedAt: number, now: number) {
  return Number.isFinite(unlockedAt) && now - unlockedAt < PARENT_IDLE_LOCK_MS;
}

export function isWithinFamily<T extends { id: string; familyId: string }>(children: T[], familyId: string | null, childId: string | null) {
  return Boolean(familyId && childId && children.some((child) => child.id === childId && child.familyId === familyId));
}
