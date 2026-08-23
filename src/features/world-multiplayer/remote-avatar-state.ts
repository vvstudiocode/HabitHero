import {
  AVATAR_STATE_EVENT,
  validateWorldEventEnvelope,
  type WorldEventRejectionReason,
} from './world-broadcast';
import type { AvatarStatePayload } from './contracts';
import type { WorldEventEnvelope } from './contracts';
import { WORLD_BOUNDARY } from './limits';

export interface RemoteAvatarStateSnapshot extends AvatarStatePayload {
  receivedAt: number;
}

export type RemoteAvatarStateRejectionReason = WorldEventRejectionReason | 'stale-sequence' | 'invalid-received-at';

export type RemoteAvatarStateResult =
  { state?: RemoteAvatarStateSnapshot; reason?: RemoteAvatarStateRejectionReason }
  & (
    | { accepted: true; state: RemoteAvatarStateSnapshot }
    | { accepted: false; reason: RemoteAvatarStateRejectionReason }
  );

export interface RemoteAvatarStateReceiverOptions {
  worldBoundary?: number;
}

export interface RemoteAvatarStateReceiver {
  accept(input: unknown, receivedAt?: number): RemoteAvatarStateResult;
  getLastSequence(connectionId: string): number | undefined;
  clear(connectionId?: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toAvatarStateEnvelope(input: unknown): WorldEventEnvelope {
  if (isRecord(input) && typeof input.event === 'string' && 'payload' in input) {
    return input as unknown as WorldEventEnvelope;
  }
  return { event: AVATAR_STATE_EVENT, payload: input };
}

export function createRemoteAvatarStateReceiver(
  options: RemoteAvatarStateReceiverOptions = {},
): RemoteAvatarStateReceiver {
  const lastSequenceByConnectionId = new Map<string, number>();
  const worldBoundary = options.worldBoundary ?? WORLD_BOUNDARY;

  const accept = (input: unknown, receivedAt = Date.now()): RemoteAvatarStateResult => {
    if (!Number.isFinite(receivedAt) || receivedAt < 0) return { accepted: false, reason: 'invalid-received-at' };
    const validation = validateWorldEventEnvelope(toAvatarStateEnvelope(input), { worldBoundary });
    if ('reason' in validation && validation.reason) return { accepted: false, reason: validation.reason };
    if (!validation.payload || !('x' in validation.payload) || !('z' in validation.payload)) {
      return { accepted: false, reason: 'unsupported-event' };
    }
    const payload = validation.payload as AvatarStatePayload;
    const previousSequence = lastSequenceByConnectionId.get(payload.connectionId);
    if (previousSequence !== undefined && payload.seq <= previousSequence) {
      return { accepted: false, reason: 'stale-sequence' };
    }
    lastSequenceByConnectionId.set(payload.connectionId, payload.seq);
    return {
      accepted: true,
      state: { ...payload, receivedAt },
    };
  };

  return {
    accept,
    getLastSequence: (connectionId) => lastSequenceByConnectionId.get(connectionId),
    clear: (connectionId) => {
      if (connectionId === undefined) lastSequenceByConnectionId.clear();
      else lastSequenceByConnectionId.delete(connectionId);
    },
  };
}

export function isRemoteAvatarStateSnapshot(value: unknown): value is RemoteAvatarStateSnapshot {
  if (!isRecord(value)) return false;
  return typeof value.connectionId === 'string'
    && typeof value.childProfileId === 'string'
    && typeof value.seq === 'number'
    && Number.isInteger(value.seq)
    && Number.isFinite(value.x)
    && Number.isFinite(value.z)
    && Number.isFinite(value.rotationY)
    && Number.isFinite(value.receivedAt);
}
