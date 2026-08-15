const PARENT_BACKGROUND_MUSIC_STORAGE_PREFIX = 'habithero.parent-background-music';

interface PreferenceStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

function getDefaultStorage(): PreferenceStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getStorageKey(familyId: string): string {
  return `${PARENT_BACKGROUND_MUSIC_STORAGE_PREFIX}:${familyId}`;
}

export function getParentBackgroundMusicPreference(
  familyId: string,
  storage = getDefaultStorage(),
): boolean {
  if (!storage || !familyId) return true;
  try {
    return storage.getItem(getStorageKey(familyId)) !== 'false';
  } catch {
    return true;
  }
}

export function setParentBackgroundMusicPreference(
  familyId: string,
  enabled: boolean,
  storage = getDefaultStorage(),
): void {
  if (!storage || !familyId) return;
  try {
    storage.setItem(getStorageKey(familyId), enabled ? 'true' : 'false');
  } catch {
    // A blocked or unavailable localStorage should not interrupt parent usage.
  }
}
