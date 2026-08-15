const PET_NAME_DISPLAY_STORAGE_PREFIX = 'habithero.pet-name-display';

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
  return `${PET_NAME_DISPLAY_STORAGE_PREFIX}:${childId}`;
}

export function getPetNameDisplayPreference(childId: string, storage = getDefaultStorage()): boolean {
  if (!storage || !childId) return true;
  try {
    return storage.getItem(getStorageKey(childId)) !== 'false';
  } catch {
    return true;
  }
}

export function setPetNameDisplayPreference(childId: string, visible: boolean, storage = getDefaultStorage()): void {
  if (!storage || !childId) return;
  try {
    storage.setItem(getStorageKey(childId), visible ? 'true' : 'false');
  } catch {
    // A blocked or unavailable localStorage should not interrupt world usage.
  }
}
