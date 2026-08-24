export const PROTOCOL_VERSION = 1 as const;

export const AVATAR_STATE_EVENT = 'avatar_state_v1' as const;
export const AVATAR_STATE_REQUEST_EVENT = 'avatar_state_request_v1' as const;
export const AVATAR_EMOTE_EVENT = 'avatar_emote_v1' as const;
export const WORLD_REVISION_EVENT = 'world_revision_v1' as const;

export type AvatarMotion = 'idle' | 'walk';
export type AvatarEmote = 'none' | 'wave' | 'sit' | 'dance';

export const AVATAR_MOTIONS: readonly AvatarMotion[] = ['idle', 'walk'];
export const AVATAR_EMOTES: readonly AvatarEmote[] = ['none', 'wave', 'sit', 'dance'];

export interface AvatarStatePayload {
  v: typeof PROTOCOL_VERSION;
  connectionId: string;
  childProfileId: string;
  characterAssetKey?: string;
  seq: number;
  x: number;
  z: number;
  rotationY: number;
  motion: AvatarMotion;
  emote: AvatarEmote;
  sentAt: number;
}

export interface AvatarEmotePayload {
  v: typeof PROTOCOL_VERSION;
  connectionId: string;
  childProfileId: string;
  seq: number;
  emote: Exclude<AvatarEmote, 'none'>;
  sentAt: number;
}

export type WorldEventName = typeof AVATAR_STATE_EVENT | typeof AVATAR_EMOTE_EVENT;
export type WorldEventPayload = AvatarStatePayload | AvatarEmotePayload;

export interface WorldEventEnvelope<TPayload = unknown> {
  event: string;
  payload: TPayload;
}

export interface AvatarStatePayloadInput {
  connectionId: string;
  childProfileId: string;
  characterAssetKey?: string;
  seq: number;
  x: number;
  z: number;
  rotationY: number;
  motion: AvatarMotion;
  emote?: AvatarEmote;
  sentAt: number;
}

export interface AvatarEmotePayloadInput {
  connectionId: string;
  childProfileId: string;
  seq: number;
  emote: Exclude<AvatarEmote, 'none'>;
  sentAt: number;
}
