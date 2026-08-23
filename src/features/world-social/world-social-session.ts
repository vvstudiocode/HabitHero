import { useSyncExternalStore } from 'react';
import type { FriendWorldSnapshot } from '../friends/friend-world-snapshot';
import type { ChildGameData } from '../world/contracts';
import type { WorldRuntimeSession } from '../world/world-runtime-multiplayer';

export interface WorldSocialSession extends WorldRuntimeSession {
  worldOwnerChildProfileId: string;
  snapshot: FriendWorldSnapshot | null;
  gameData?: ChildGameData;
  fixedSpawn: { x: number; z: number };
  multiplayer: NonNullable<WorldRuntimeSession['multiplayer']>;
}

let currentSession: WorldSocialSession | null = null;
const listeners = new Set<() => void>();

export function setWorldSocialSession(session: WorldSocialSession | null): void {
  currentSession = session;
  listeners.forEach((listener) => listener());
}

export function useWorldSocialSession(): WorldSocialSession | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => currentSession,
    () => null,
  );
}
