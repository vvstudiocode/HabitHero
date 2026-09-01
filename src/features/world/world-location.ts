import { WORLD_BOUNDARY } from './world-collision';
import { CLOUD_WORKSHOP_MOVEMENT_BOUNDARY } from './cloud-workshop';
import { FOREST_VALLEY_MOVEMENT_BOUNDARY } from './forest-valley';

export { FOREST_VALLEY_MOVEMENT_BOUNDARY } from './forest-valley';

export type WorldLocation = 'sunrise-village' | 'forest-valley' | 'cloud-workshop' | 'my-world';

export const DEFAULT_WORLD_LOCATION: WorldLocation = 'sunrise-village';
export const SUNRISE_VILLAGE_MOVEMENT_BOUNDARY = 12.4;

const WORLD_LOCATION_STORAGE_PREFIX = 'habithero:world-location:';

export type WorldLocationStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function isWorldLocation(value: unknown): value is WorldLocation {
  return value === 'sunrise-village' || value === 'forest-valley' || value === 'cloud-workshop' || value === 'my-world';
}

export function getWorldMovementBoundary(location: WorldLocation): number {
  if (location === 'sunrise-village') return SUNRISE_VILLAGE_MOVEMENT_BOUNDARY;
  if (location === 'forest-valley') return FOREST_VALLEY_MOVEMENT_BOUNDARY;
  if (location === 'cloud-workshop') return CLOUD_WORKSHOP_MOVEMENT_BOUNDARY;
  return WORLD_BOUNDARY;
}

function resolveStorage(storage?: WorldLocationStorage): WorldLocationStorage | undefined {
  if (storage) return storage;
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function getStorageKey(childProfileId: string): string {
  return `${WORLD_LOCATION_STORAGE_PREFIX}${childProfileId}`;
}

export function getStoredWorldLocation(childProfileId: string, storage?: WorldLocationStorage): WorldLocation {
  if (!childProfileId.trim()) return DEFAULT_WORLD_LOCATION;
  try {
    const persisted = resolveStorage(storage)?.getItem(getStorageKey(childProfileId));
    return isWorldLocation(persisted) ? persisted : DEFAULT_WORLD_LOCATION;
  } catch {
    return DEFAULT_WORLD_LOCATION;
  }
}

export function saveWorldLocation(childProfileId: string, location: WorldLocation, storage?: WorldLocationStorage): void {
  if (!childProfileId.trim()) return;
  try {
    resolveStorage(storage)?.setItem(getStorageKey(childProfileId), location);
  } catch {
    // A private browsing context or a full storage quota should not block play.
  }
}
