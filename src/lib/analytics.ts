import { Capacitor } from '@capacitor/core';
import { getSupabaseClient } from './supabase';

export const ANALYTICS_EVENT_NAMES = [
  'app_open',
  'session_start',
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
  event_name: AnalyticsEventName;
  session_id: string;
  child_profile_id?: string;
  screen_name?: string;
  properties: Record<string, string | number | boolean>;
  platform: 'web' | 'ios' | 'android' | 'unknown';
  app_version?: string;
  occurred_at: string;
}

interface AnalyticsEventOptions {
  sessionId: string;
  childProfileId?: string | null;
  screenName?: string | null;
  platform?: AnalyticsEventPayload['platform'];
  appVersion?: string;
  occurredAt?: Date;
}

const SESSION_STORAGE_KEY = 'habithero:analytics-session:v1';
const QUEUE_STORAGE_PREFIX = 'habithero:analytics-queue:v1:';
const MAX_QUEUE_SIZE = 100;
const MAX_STRING_LENGTH = 80;
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

let analyticsContext: AnalyticsContext | null = null;
let analyticsSessionId: string | null = null;
let analyticsSessionStartedAt = 0;
let analyticsSessionEnded = false;
let analyticsCurrentScreen: string | null = null;
let analyticsQueue: AnalyticsEventPayload[] = [];
let analyticsQueueUserId: string | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushInFlight: Promise<void> | null = null;
let lifecycleBound = false;

function getBrowserStorage(kind: 'localStorage' | 'sessionStorage'): AnalyticsStorage | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window[kind];
  } catch {
    return undefined;
  }
}

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.random() * 16 | 0;
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function getAnalyticsSessionId(storage = getBrowserStorage('sessionStorage')) {
  const existing = storage?.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;
  const next = createId();
  try {
    storage?.setItem(SESSION_STORAGE_KEY, next);
  } catch {
    // Analytics must never block the app when browser storage is unavailable.
  }
  return next;
}

function saveAnalyticsSessionId(sessionId: string) {
  try {
    getBrowserStorage('sessionStorage')?.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    // Ignore restricted storage.
  }
}

function sanitizeProperties(properties: Record<string, unknown> | undefined) {
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
    event_name: eventName,
    session_id: options.sessionId,
    properties: sanitizeProperties(properties),
    platform: options.platform ?? 'web',
    occurred_at: (options.occurredAt ?? new Date()).toISOString(),
  };
  if (options.childProfileId) payload.child_profile_id = options.childProfileId;
  if (options.screenName?.trim()) payload.screen_name = options.screenName.trim().slice(0, MAX_STRING_LENGTH);
  if (options.appVersion?.trim()) payload.app_version = options.appVersion.trim().slice(0, 40);
  return payload;
}

function getPlatform(): AnalyticsEventPayload['platform'] {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android' || platform === 'web' ? platform : 'unknown';
}

function queueStorageKey(userId: string) {
  return `${QUEUE_STORAGE_PREFIX}${userId}`;
}

function loadQueue(userId: string) {
  try {
    const raw = getBrowserStorage('localStorage')?.getItem(queueStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AnalyticsEventPayload[];
    return Array.isArray(parsed) ? parsed.slice(-MAX_QUEUE_SIZE) : [];
  } catch {
    return [];
  }
}

function persistQueue() {
  if (!analyticsQueueUserId) return;
  try {
    getBrowserStorage('localStorage')?.setItem(
      queueStorageKey(analyticsQueueUserId),
      JSON.stringify(analyticsQueue.slice(-MAX_QUEUE_SIZE)),
    );
  } catch {
    // Ignore restricted storage and keep the in-memory queue.
  }
}

function scheduleFlush(delay = 900) {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAnalyticsEvents();
  }, delay);
}

export async function flushAnalyticsEvents() {
  if (!analyticsContext || analyticsQueue.length === 0) return;
  if (flushInFlight) return flushInFlight;
  const batch = analyticsQueue.slice(0, 50);
  const batchLength = batch.length;
  const batchOwner = analyticsQueueUserId;
  flushInFlight = (async () => {
    try {
      const { error } = await getSupabaseClient().rpc('record_analytics_events', { event_batch: batch });
      if (error) return;
      if (analyticsQueueUserId === batchOwner) {
        analyticsQueue = analyticsQueue.slice(batchLength);
        persistQueue();
        if (analyticsQueue.length > 0) scheduleFlush(0);
      }
    } catch {
      // Keep the queue for the next app open or network recovery.
    } finally {
      flushInFlight = null;
    }
  })();
  return flushInFlight;
}

export function trackAnalyticsEvent(eventName: AnalyticsEventName, properties?: Record<string, unknown>) {
  if (!analyticsContext || !analyticsSessionId || analyticsSessionEnded) return;
  const event = buildAnalyticsEvent(eventName, properties, {
    sessionId: analyticsSessionId,
    childProfileId: analyticsContext.childProfileId,
    screenName: analyticsCurrentScreen,
    platform: getPlatform(),
    appVersion: analyticsContext.appVersion,
  });
  analyticsQueue.push(event);
  analyticsQueue = analyticsQueue.slice(-MAX_QUEUE_SIZE);
  persistQueue();
  scheduleFlush();
}

export function trackAnalyticsScreen(screenName: string) {
  const normalizedScreen = screenName.trim().slice(0, MAX_STRING_LENGTH);
  if (!normalizedScreen || normalizedScreen === analyticsCurrentScreen) return;
  analyticsCurrentScreen = normalizedScreen;
  trackAnalyticsEvent('screen_view', { screen: normalizedScreen });
}

function trackButtonClick(event: MouseEvent) {
  if (!analyticsContext || analyticsSessionEnded) return;
  const target = event.target instanceof Element
    ? event.target.closest<HTMLElement>('button, a, [role="button"]')
    : null;
  if (!target || target.hasAttribute('data-analytics-ignore')) return;
  const control = target.dataset.analyticsId
    || target.getAttribute('aria-label')
    || target.textContent?.replace(/\s+/g, ' ').trim().slice(0, MAX_STRING_LENGTH);
  if (control) trackAnalyticsEvent('button_click', { control });
}

function endAnalyticsSession() {
  if (!analyticsContext || analyticsSessionEnded || analyticsSessionStartedAt === 0) return;
  const durationSeconds = Math.max(0, Math.round((Date.now() - analyticsSessionStartedAt) / 1000));
  trackAnalyticsEvent('session_end', { duration_seconds: durationSeconds });
  analyticsSessionEnded = true;
  void flushAnalyticsEvents();
}

function startAnalyticsSession() {
  analyticsSessionId = createId();
  saveAnalyticsSessionId(analyticsSessionId);
  analyticsSessionStartedAt = Date.now();
  analyticsSessionEnded = false;
  trackAnalyticsEvent('app_open');
  trackAnalyticsEvent('session_start');
}

function resumeAnalyticsSession() {
  if (!analyticsContext || !analyticsSessionEnded) return;
  startAnalyticsSession();
}

function bindLifecycle() {
  if (lifecycleBound || typeof window === 'undefined' || typeof document === 'undefined') return;
  lifecycleBound = true;
  document.addEventListener('click', trackButtonClick, true);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') endAnalyticsSession();
    else resumeAnalyticsSession();
  });
  window.addEventListener('pagehide', endAnalyticsSession);
  window.addEventListener('online', () => { void flushAnalyticsEvents(); });
}

export function configureAnalytics(nextContext: AnalyticsContext | null) {
  if (!nextContext) {
    endAnalyticsSession();
    analyticsContext = null;
    analyticsSessionId = null;
    analyticsCurrentScreen = null;
    return;
  }
  if (analyticsContext?.userId !== nextContext.userId) {
    endAnalyticsSession();
    analyticsSessionId = null;
    analyticsCurrentScreen = null;
  }
  analyticsContext = nextContext;
  if (analyticsQueueUserId !== nextContext.userId) {
    analyticsQueueUserId = nextContext.userId;
    analyticsQueue = loadQueue(nextContext.userId);
  }
  if (!analyticsSessionId || analyticsSessionEnded) startAnalyticsSession();
  bindLifecycle();
  void flushAnalyticsEvents();
}
