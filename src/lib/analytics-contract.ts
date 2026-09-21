export const ANALYTICS_EVENT_NAMES = [
  'app_open',
  'session_start',
  'session_checkpoint',
  'session_end',
  'screen_view',
  'button_click',
  'tutorial_step',
  'world_enter',
  'world_exit',
  'scene_enter',
  'scene_exit',
  'scene_dwell',
] as const;

export type AnalyticsEventName = typeof ANALYTICS_EVENT_NAMES[number];
export type AnalyticsPlatform = 'web' | 'ios' | 'android' | 'unknown';

export interface AnalyticsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AnalyticsContext {
  userId: string;
  childProfileId?: string | null;
  appVersion?: string;
}

export interface AnalyticsEventPayload {
  event_id: string;
  actor_profile_id: string;
  event_name: AnalyticsEventName;
  session_id: string;
  child_profile_id?: string;
  screen_name?: string;
  properties: Record<string, string | number | boolean>;
  platform: AnalyticsPlatform;
  app_version?: string;
  occurred_at: string;
}

export interface AnalyticsEventOptions {
  sessionId: string;
  eventId: string;
  actorProfileId: string;
  childProfileId?: string | null;
  screenName?: string | null;
  platform?: AnalyticsPlatform;
  appVersion?: string;
  occurredAt?: Date;
}

export interface AnalyticsWorldView {
  key: string;
  scene: string;
  location?: string;
  target?: string;
  visible: boolean;
}

export interface AnalyticsTrackerOptions {
  storage?: AnalyticsStorage;
  sessionStorage?: AnalyticsStorage;
  transport?: (events: AnalyticsEventPayload[]) => Promise<void>;
  now?: () => number;
  createId?: () => string;
  platform?: AnalyticsPlatform;
  appVersion?: string;
  autoFlush?: boolean;
  flushDelayMs?: number;
  checkpointIntervalMs?: number;
}

export interface AnalyticsTracker {
  configure(context: AnalyticsContext | null): void;
  track(eventName: AnalyticsEventName, properties?: Record<string, unknown>): void;
  screen(screenName: string): void;
  checkpoint(): void;
  setForeground(isForeground: boolean): void;
  setWorldView(view: AnalyticsWorldView | null): void;
  setWorldViewVisible(visible: boolean): void;
  endSession(): void;
  flush(): Promise<void>;
  bindLifecycle(): void;
  dispose(): void;
}

export const SESSION_STORAGE_KEY = 'habithero:analytics-session:v1';
export const QUEUE_STORAGE_PREFIX = 'habithero:analytics-queue:v1:';
export const MAX_QUEUE_SIZE = 100;
export const MAX_STRING_LENGTH = 80;
export const DEFAULT_CHECKPOINT_INTERVAL_MS = 15_000;

const SAFE_PROPERTY_KEYS = new Set([
  'control',
  'screen',
  'step',
  'action',
  'location',
  'from',
  'to',
  'scene',
  'target',
  'duration_seconds',
]);

export function getAnalyticsBrowserStorage(kind: 'localStorage' | 'sessionStorage'): AnalyticsStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window[kind];
  } catch {
    return undefined;
  }
}

export function createAnalyticsId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.random() * 16 | 0;
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function getAnalyticsSessionId(storage = getAnalyticsBrowserStorage('sessionStorage')) {
  let existing: string | null = null;
  try {
    existing = storage?.getItem(SESSION_STORAGE_KEY) ?? null;
  } catch {
    existing = null;
  }
  if (existing) return existing;
  const next = createAnalyticsId();
  try {
    storage?.setItem(SESSION_STORAGE_KEY, next);
  } catch {
    // Restricted storage must never block the app.
  }
  return next;
}

export function sanitizeAnalyticsProperties(properties: Record<string, unknown> | undefined) {
  const safeProperties: Record<string, string | number | boolean> = {};
  if (!properties) return safeProperties;
  for (const [key, value] of Object.entries(properties)) {
    if (!SAFE_PROPERTY_KEYS.has(key)) continue;
    if (typeof value === 'string' && value.trim()) safeProperties[key] = value.trim().slice(0, MAX_STRING_LENGTH);
    if (typeof value === 'boolean') safeProperties[key] = value;
    if (typeof value === 'number' && Number.isFinite(value)) safeProperties[key] = Math.max(0, Math.min(value, 86400));
  }
  return safeProperties;
}

export function buildAnalyticsEvent(
  eventName: AnalyticsEventName,
  properties: Record<string, unknown> | undefined,
  options: AnalyticsEventOptions,
): AnalyticsEventPayload {
  const payload: AnalyticsEventPayload = {
    event_id: options.eventId,
    actor_profile_id: options.actorProfileId,
    event_name: eventName,
    session_id: options.sessionId,
    properties: sanitizeAnalyticsProperties(properties),
    platform: options.platform ?? 'web',
    occurred_at: (options.occurredAt ?? new Date()).toISOString(),
  };
  if (options.childProfileId) payload.child_profile_id = options.childProfileId;
  if (options.screenName?.trim()) payload.screen_name = options.screenName.trim().slice(0, MAX_STRING_LENGTH);
  if (options.appVersion?.trim()) payload.app_version = options.appVersion.trim().slice(0, 40);
  return payload;
}

export function normalizeAnalyticsQueueEvent(
  raw: unknown,
  actorProfileId: string,
  makeId: () => string,
  now: () => number,
): AnalyticsEventPayload | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const candidate = raw as Partial<AnalyticsEventPayload>;
  if (!ANALYTICS_EVENT_NAMES.includes(candidate.event_name as AnalyticsEventName)) return null;
  if (typeof candidate.session_id !== 'string' || !candidate.session_id.trim()) return null;
  if (candidate.actor_profile_id && candidate.actor_profile_id !== actorProfileId) return null;
  const platform = candidate.platform === 'ios' || candidate.platform === 'android' || candidate.platform === 'web' || candidate.platform === 'unknown'
    ? candidate.platform
    : 'web';
  const occurredAt = typeof candidate.occurred_at === 'string' && !Number.isNaN(Date.parse(candidate.occurred_at))
    ? candidate.occurred_at
    : new Date(now()).toISOString();
  return {
    event_id: isUuid(candidate.event_id) ? candidate.event_id : makeId(),
    actor_profile_id: actorProfileId,
    event_name: candidate.event_name as AnalyticsEventName,
    session_id: candidate.session_id,
    ...(typeof candidate.child_profile_id === 'string' && candidate.child_profile_id ? { child_profile_id: candidate.child_profile_id } : {}),
    ...(typeof candidate.screen_name === 'string' && candidate.screen_name ? { screen_name: candidate.screen_name.slice(0, MAX_STRING_LENGTH) } : {}),
    properties: sanitizeAnalyticsProperties(candidate.properties as Record<string, unknown> | undefined),
    platform,
    ...(typeof candidate.app_version === 'string' && candidate.app_version ? { app_version: candidate.app_version.slice(0, 40) } : {}),
    occurred_at: occurredAt,
  };
}

export function getStaticAnalyticsControlId(target: { getAttribute(name: string): string | null } | null): string | null {
  const control = target?.getAttribute('data-analytics-id')?.trim() ?? '';
  return /^(?:app|auth|child|guide|parent|tutorial|world)-[a-z0-9:_-]{1,63}$/i.test(control) ? control : null;
}

export function isAnalyticsRetryable(error: unknown) {
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : NaN;
  if (Number.isInteger(status)) return status === 408 || status === 409 || status === 429 || status >= 500;
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  return !/^(?:22|23|42)/.test(code);
}
