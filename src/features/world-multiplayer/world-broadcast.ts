import {
  AVATAR_EMOTE_EVENT,
  AVATAR_MOTIONS,
  AVATAR_EMOTES,
  AVATAR_STATE_EVENT,
  PROTOCOL_VERSION,
  type AvatarEmote,
  type AvatarEmotePayload,
  type AvatarEmotePayloadInput,
  type AvatarMotion,
  type AvatarStatePayload,
  type AvatarStatePayloadInput,
  type WorldEventEnvelope,
} from './contracts';
import {
  AVATAR_KEEPALIVE_INTERVAL_MS,
  AVATAR_MIN_BROADCAST_INTERVAL_MS,
  AVATAR_POSITION_DELTA_THRESHOLD,
  AVATAR_ROTATION_DELTA_RADIANS,
  MAX_REALTIME_EVENT_BYTES,
  MIN_SEQUENCE,
  WORLD_BOUNDARY,
} from './limits';
import {
  isFiniteNonNegative,
  isOneOf,
  isOptionalCharacterAssetKey,
  isRecord,
  isShortIdentity,
} from './world-broadcast-validation';

export {
  AVATAR_EMOTE_EVENT,
  AVATAR_STATE_EVENT,
  PROTOCOL_VERSION,
} from './contracts';
export {
  AVATAR_KEEPALIVE_INTERVAL_MS,
  AVATAR_POSITION_DELTA_THRESHOLD,
  AVATAR_ROTATION_DELTA_RADIANS,
  MAX_AVATAR_BROADCASTS_PER_SECOND,
} from './limits';
export type { AvatarMotion } from './contracts';

export type WorldEventRejectionReason =
  | 'invalid-envelope'
  | 'unsupported-event'
  | 'event-too-large'
  | 'unsupported-version'
  | 'invalid-identity'
  | 'invalid-character'
  | 'invalid-sequence'
  | 'non-finite-position'
  | 'out-of-bounds-position'
  | 'invalid-rotation'
  | 'invalid-motion'
  | 'invalid-emote'
  | 'invalid-sent-at';

export type WorldEventValidationResult =
  { payload?: AvatarStatePayload | AvatarEmotePayload; reason?: WorldEventRejectionReason } & (
    | { accepted: true; payload: AvatarStatePayload | AvatarEmotePayload }
    | { accepted: false; reason: WorldEventRejectionReason }
  );

export interface WorldEventValidationOptions {
  worldBoundary?: number;
}

function validateIdentityAndSequence(payload: Record<string, unknown>): WorldEventRejectionReason | null {
  if (!isShortIdentity(payload.connectionId) || !isShortIdentity(payload.childProfileId)) return 'invalid-identity';
  if (!Number.isInteger(payload.seq) || (payload.seq as number) < MIN_SEQUENCE) return 'invalid-sequence';
  if (!isFiniteNonNegative(payload.sentAt)) return 'invalid-sent-at';
  if (payload.v !== PROTOCOL_VERSION) return 'unsupported-version';
  return null;
}

function validateAvatarStatePayload(
  payload: unknown,
  worldBoundary: number,
): { accepted: true; payload: AvatarStatePayload } | { accepted: false; reason: WorldEventRejectionReason } {
  if (!isRecord(payload)) return { accepted: false, reason: 'invalid-envelope' };
  const commonError = validateIdentityAndSequence(payload);
  if (commonError) return { accepted: false, reason: commonError };
  if (!isOptionalCharacterAssetKey(payload.characterAssetKey)) return { accepted: false, reason: 'invalid-character' };
  if (!Number.isFinite(payload.x) || !Number.isFinite(payload.z)) {
    return { accepted: false, reason: 'non-finite-position' };
  }
  if (Math.abs(payload.x as number) > worldBoundary || Math.abs(payload.z as number) > worldBoundary) {
    return { accepted: false, reason: 'out-of-bounds-position' };
  }
  if (!Number.isFinite(payload.rotationY)) return { accepted: false, reason: 'invalid-rotation' };
  if (!isOneOf(AVATAR_MOTIONS, payload.motion)) return { accepted: false, reason: 'invalid-motion' };
  if (!isOneOf(AVATAR_EMOTES, payload.emote)) return { accepted: false, reason: 'invalid-emote' };
  return { accepted: true, payload: payload as unknown as AvatarStatePayload };
}

function validateAvatarEmotePayload(
  payload: unknown,
): { accepted: true; payload: AvatarEmotePayload } | { accepted: false; reason: WorldEventRejectionReason } {
  if (!isRecord(payload)) return { accepted: false, reason: 'invalid-envelope' };
  const commonError = validateIdentityAndSequence(payload);
  if (commonError) return { accepted: false, reason: commonError };
  if (!isOneOf(AVATAR_EMOTES.filter((emote) => emote !== 'none'), payload.emote)) {
    return { accepted: false, reason: 'invalid-emote' };
  }
  return { accepted: true, payload: payload as unknown as AvatarEmotePayload };
}

function safeJson(value: unknown): string | null {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? null : serialized;
  } catch {
    return null;
  }
}

export function getWorldPayloadByteLength(payload: unknown): number {
  const serialized = safeJson(payload);
  if (serialized === null) return Number.POSITIVE_INFINITY;
  return new TextEncoder().encode(serialized).byteLength;
}

export function getWorldEventByteLength(event: unknown): number {
  const serialized = safeJson(event);
  if (serialized === null) return Number.POSITIVE_INFINITY;
  return new TextEncoder().encode(serialized).byteLength;
}

export function validateWorldEventEnvelope(
  input: unknown,
  options: WorldEventValidationOptions = {},
): WorldEventValidationResult {
  if (!isRecord(input) || typeof input.event !== 'string' || !('payload' in input)) {
    return { accepted: false, reason: 'invalid-envelope' };
  }
  if (getWorldEventByteLength(input) > MAX_REALTIME_EVENT_BYTES) {
    return { accepted: false, reason: 'event-too-large' };
  }
  if (!Number.isFinite(options.worldBoundary ?? WORLD_BOUNDARY) || (options.worldBoundary ?? WORLD_BOUNDARY) <= 0) {
    return { accepted: false, reason: 'out-of-bounds-position' };
  }
  if (input.event === AVATAR_STATE_EVENT) {
    return validateAvatarStatePayload(input.payload, options.worldBoundary ?? WORLD_BOUNDARY);
  }
  if (input.event === AVATAR_EMOTE_EVENT) return validateAvatarEmotePayload(input.payload);
  return { accepted: false, reason: 'unsupported-event' };
}

function requireValidPayload<T extends AvatarStatePayload | AvatarEmotePayload>(
  result: WorldEventValidationResult,
): T {
  if ('reason' in result && result.reason) throw new RangeError(`Invalid world multiplayer payload: ${result.reason}`);
  return result.payload as T;
}

export function buildAvatarStatePayload(input: AvatarStatePayloadInput): AvatarStatePayload {
  const result = validateWorldEventEnvelope({
    event: AVATAR_STATE_EVENT,
    payload: { ...input, v: PROTOCOL_VERSION, emote: input.emote ?? 'none' },
  });
  return requireValidPayload<AvatarStatePayload>(result);
}

export function buildAvatarEmotePayload(input: AvatarEmotePayloadInput): AvatarEmotePayload {
  const result = validateWorldEventEnvelope({
    event: AVATAR_EMOTE_EVENT,
    payload: { ...input, v: PROTOCOL_VERSION },
  });
  return requireValidPayload<AvatarEmotePayload>(result);
}

export function getShortestAngleDistance(from: number, to: number): number {
  const fullTurn = Math.PI * 2;
  return ((to - from + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
}

export function normalizeWorldAngle(angle: number): number {
  const fullTurn = Math.PI * 2;
  return ((angle + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
}

export interface AvatarBroadcastInput {
  now: number;
  x: number;
  z: number;
  rotationY: number;
  motion: AvatarMotion;
  emote?: AvatarEmote;
  characterAssetKey?: string;
  otherMemberCount: number;
}

export interface AvatarBroadcastControllerOptions {
  connectionId: string;
  childProfileId: string;
  initialSequence?: number;
}

export type AvatarBroadcastSkipReason =
  | 'no-other-members'
  | 'invalid-input'
  | 'unchanged'
  | 'throttled';

export interface AvatarBroadcastResult {
  event: AvatarStatePayload | null;
  reason: AvatarBroadcastSkipReason | null;
}

export interface AvatarBroadcastController {
  next(input: AvatarBroadcastInput): AvatarBroadcastResult;
  getLastSent(): AvatarStatePayload | null;
  reset(): void;
}

function isValidBroadcastInput(input: AvatarBroadcastInput): boolean {
  return Number.isFinite(input.now)
    && input.now >= 0
    && Number.isInteger(input.otherMemberCount)
    && input.otherMemberCount >= 0
    && Number.isFinite(input.x)
    && Number.isFinite(input.z)
    && Math.abs(input.x) <= WORLD_BOUNDARY
    && Math.abs(input.z) <= WORLD_BOUNDARY
    && Number.isFinite(input.rotationY)
    && isOneOf(AVATAR_MOTIONS, input.motion)
    && isOneOf(AVATAR_EMOTES, input.emote ?? 'none')
    && isOptionalCharacterAssetKey(input.characterAssetKey);
}

export function createAvatarBroadcastController(
  options: AvatarBroadcastControllerOptions,
): AvatarBroadcastController {
  let sequence = options.initialSequence ?? 0;
  if (!Number.isInteger(sequence) || sequence < 0) throw new TypeError('initialSequence must be a non-negative integer.');
  let lastSent: AvatarStatePayload | null = null;

  const next = (input: AvatarBroadcastInput): AvatarBroadcastResult => {
    if (!Number.isInteger(input.otherMemberCount) || input.otherMemberCount < 0) {
      return { event: null, reason: 'invalid-input' };
    }
    if (input.otherMemberCount === 0) return { event: null, reason: 'no-other-members' };
    if (!isValidBroadcastInput(input)) return { event: null, reason: 'invalid-input' };

    const candidate = buildAvatarStatePayload({
      connectionId: options.connectionId,
      childProfileId: options.childProfileId,
      characterAssetKey: input.characterAssetKey,
      seq: sequence + 1,
      x: input.x,
      z: input.z,
      rotationY: input.rotationY,
      motion: input.motion,
      emote: input.emote ?? 'none',
      sentAt: input.now,
    });
    const stopping = lastSent?.motion === 'walk' && candidate.motion === 'idle';
    const changedPosition = !lastSent
      || Math.hypot(candidate.x - lastSent.x, candidate.z - lastSent.z) >= AVATAR_POSITION_DELTA_THRESHOLD;
    const changedRotation = !lastSent
      || Math.abs(getShortestAngleDistance(lastSent.rotationY, candidate.rotationY)) >= AVATAR_ROTATION_DELTA_RADIANS;
    const changedPresentation = !lastSent
      || candidate.motion !== lastSent.motion
      || candidate.emote !== lastSent.emote
      || candidate.characterAssetKey !== lastSent.characterAssetKey;
    const keepaliveDue = Boolean(lastSent)
      && candidate.motion === 'idle'
      && candidate.sentAt - lastSent.sentAt >= AVATAR_KEEPALIVE_INTERVAL_MS;
    if (!changedPosition && !changedRotation && !changedPresentation && !stopping && !keepaliveDue) {
      return { event: null, reason: 'unchanged' };
    }
    if (lastSent && candidate.sentAt - lastSent.sentAt < AVATAR_MIN_BROADCAST_INTERVAL_MS) {
      return { event: null, reason: 'throttled' };
    }
    sequence += 1;
    lastSent = candidate;
    return { event: { ...candidate }, reason: null };
  };

  return {
    next,
    getLastSent: () => (lastSent ? { ...lastSent } : null),
    reset: () => {
      sequence = options.initialSequence ?? 0;
      lastSent = null;
    },
  };
}

export type { AvatarEmote, AvatarStatePayload, WorldEventEnvelope } from './contracts';
