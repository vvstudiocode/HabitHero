const BACKGROUND_MUSIC_STORAGE_PREFIX = 'habithero.background-music';

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

function getStorageKey(childId: string): string {
  return `${BACKGROUND_MUSIC_STORAGE_PREFIX}:${childId}`;
}

export function getBackgroundMusicPreference(
  childId: string,
  storage = getDefaultStorage(),
): boolean {
  if (!storage || !childId) return true;
  try {
    return storage.getItem(getStorageKey(childId)) !== 'false';
  } catch {
    return true;
  }
}

export function setBackgroundMusicPreference(
  childId: string,
  enabled: boolean,
  storage = getDefaultStorage(),
): void {
  if (!storage || !childId) return;
  try {
    storage.setItem(getStorageKey(childId), enabled ? 'true' : 'false');
  } catch {
    // A blocked or unavailable localStorage should not interrupt world usage.
  }
}
