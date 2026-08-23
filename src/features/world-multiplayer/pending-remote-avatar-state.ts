import type { RemoteAvatarStateSnapshot } from './remote-avatar-state';
import type { WorldPresenceMember } from './world-presence';

export interface PendingRemoteAvatarFlushContext {
  presenceMembers: readonly WorldPresenceMember[];
  acceptedConnectionIds: readonly string[];
}

export interface PendingRemoteAvatarStateQueue {
  enqueue(state: RemoteAvatarStateSnapshot): void;
  flush(context: PendingRemoteAvatarFlushContext): RemoteAvatarStateSnapshot[];
  clear(): void;
  size(): number;
}

function isReady(state: RemoteAvatarStateSnapshot, context: PendingRemoteAvatarFlushContext): boolean {
  const member = context.presenceMembers.find((candidate) => candidate.connectionId === state.connectionId);
  return Boolean(member)
    && member?.childProfileId === state.childProfileId
    && context.acceptedConnectionIds.includes(state.connectionId);
}

export function createPendingRemoteAvatarStateQueue(): PendingRemoteAvatarStateQueue {
  const pendingByConnectionId = new Map<string, RemoteAvatarStateSnapshot>();

  return {
    enqueue: (state) => {
      const previous = pendingByConnectionId.get(state.connectionId);
      if (!previous || state.seq > previous.seq) pendingByConnectionId.set(state.connectionId, { ...state });
    },
    flush: (context) => {
      const ready: RemoteAvatarStateSnapshot[] = [];
      pendingByConnectionId.forEach((state, connectionId) => {
        if (!isReady(state, context)) return;
        ready.push({ ...state });
        pendingByConnectionId.delete(connectionId);
      });
      return ready;
    },
    clear: () => pendingByConnectionId.clear(),
    size: () => pendingByConnectionId.size,
  };
}

export const createPendingRemoteAvatarStateBuffer = createPendingRemoteAvatarStateQueue;
