import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  ANALYTICS_EVENT_NAMES,
  DEFAULT_CHECKPOINT_INTERVAL_MS,
  MAX_QUEUE_SIZE,
  MAX_STRING_LENGTH,
  QUEUE_STORAGE_PREFIX,
  buildAnalyticsEvent,
  createAnalyticsId,
  getAnalyticsBrowserStorage,
  getStaticAnalyticsControlId,
  isAnalyticsRetryable,
  normalizeAnalyticsQueueEvent,
  type AnalyticsContext,
  type AnalyticsEventName,
  type AnalyticsEventPayload,
  type AnalyticsPlatform,
  type AnalyticsTracker,
  type AnalyticsTrackerOptions,
  type AnalyticsWorldView,
} from './analytics-contract';
import { getSupabaseClient } from './supabase';

function queueStorageKey(userId: string) {
  return `${QUEUE_STORAGE_PREFIX}${userId}`;
}

function getPlatform(): AnalyticsPlatform {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' || platform === 'android' || platform === 'web' ? platform : 'unknown';
}

export function createAnalyticsTracker(options: AnalyticsTrackerOptions = {}): AnalyticsTracker {
  const storage = options.storage ?? getAnalyticsBrowserStorage('localStorage');
  const sessionStorage = options.sessionStorage ?? getAnalyticsBrowserStorage('sessionStorage');
  const now = options.now ?? Date.now;
  const makeId = options.createId ?? createAnalyticsId;
  const platform = options.platform ?? getPlatform();
  const transport = options.transport ?? (async (events: AnalyticsEventPayload[]) => {
    const response = await getSupabaseClient().rpc('record_analytics_events', { event_batch: events });
    if (response.error) {
      const failure = Object.assign(response.error, { status: response.status });
      throw failure;
    }
  });
  const autoFlush = options.autoFlush ?? true;
  const flushDelayMs = options.flushDelayMs ?? 900;
  const checkpointIntervalMs = options.checkpointIntervalMs ?? DEFAULT_CHECKPOINT_INTERVAL_MS;

  let context: AnalyticsContext | null = null;
  let sessionId: string | null = null;
  let foregroundStartedAt: number | null = null;
  let foregroundDurationMs = 0;
  let lastCheckpointSeconds = -1;
  let sessionEnded = true;
  let foregroundActive = true;
  let desiredScreen: string | null = null;
  let emittedScreen: string | null = null;
  let worldView: (AnalyticsWorldView & { startedAt: number | null }) | null = null;
  let queue: AnalyticsEventPayload[] = [];
  let queueActorId: string | null = null;
  let queueGeneration = 0;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let checkpointTimer: ReturnType<typeof setInterval> | null = null;
  let flushInFlight: Promise<void> | null = null;
  let flushFailureCount = 0;
  let lifecycleBound = false;
  let disposed = false;
  let nativeListener: { remove: () => Promise<void> } | null = null;
  let documentVisible = true;
  let nativeActive = true;

  const persistQueue = () => {
    if (!queueActorId) return;
    try {
      storage?.setItem(queueStorageKey(queueActorId), JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)));
    } catch {
      // Keep the in-memory queue when browser storage is unavailable.
    }
  };

  const loadQueue = (actorProfileId: string) => {
    try {
      const raw = storage?.getItem(queueStorageKey(actorProfileId));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((event) => normalizeAnalyticsQueueEvent(event, actorProfileId, makeId, now))
        .filter((event): event is AnalyticsEventPayload => event !== null)
        .slice(-MAX_QUEUE_SIZE);
    } catch {
      return [];
    }
  };

  const scheduleFlush = (delay = flushDelayMs) => {
    if (!autoFlush || flushTimer !== null || disposed) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void tracker.flush();
    }, delay);
  };

  const currentDurationSeconds = () => {
    const openForegroundMs = foregroundStartedAt === null ? 0 : Math.max(0, now() - foregroundStartedAt);
    return Math.max(0, Math.floor((foregroundDurationMs + openForegroundMs) / 1000));
  };

  const append = (eventName: AnalyticsEventName, properties?: Record<string, unknown>) => {
    if (!context || !sessionId || sessionEnded) return;
    const event = buildAnalyticsEvent(eventName, properties, {
      sessionId,
      eventId: makeId(),
      actorProfileId: context.userId,
      childProfileId: context.childProfileId,
      screenName: emittedScreen,
      platform,
      appVersion: context.appVersion ?? options.appVersion,
      occurredAt: new Date(now()),
    });
    queue.push(event);
    queue = queue.slice(-MAX_QUEUE_SIZE);
    persistQueue();
    scheduleFlush();
  };

  const emitScreen = () => {
    if (!desiredScreen || !context || !sessionId || sessionEnded || desiredScreen === emittedScreen) return;
    emittedScreen = desiredScreen;
    append('screen_view', { screen: desiredScreen });
  };

  const closeForegroundSegment = () => {
    if (foregroundStartedAt === null) return;
    foregroundDurationMs += Math.max(0, now() - foregroundStartedAt);
    foregroundStartedAt = null;
  };

  const closeWorldSegment = () => {
    if (!worldView || worldView.startedAt === null) return;
    const durationSeconds = Math.max(0, Math.floor((now() - worldView.startedAt) / 1000));
    worldView.startedAt = null;
    // scene_dwell is intentionally minimal: the SQL worker accepts only the
    // scene identifier and cumulative/delta duration field for this event.
    if (durationSeconds > 0) append('scene_dwell', { scene: worldView.scene, duration_seconds: durationSeconds });
  };

  const closeWorldView = () => {
    if (!worldView) return;
    closeWorldSegment();
    append('scene_exit', { scene: worldView.scene });
    append('world_exit', { location: worldView.location ?? worldView.scene, ...(worldView.target ? { target: worldView.target } : {}) });
    worldView = null;
  };

  const checkpointWorldSegment = () => {
    closeWorldSegment();
    if (worldView?.visible && foregroundActive && !sessionEnded) worldView.startedAt = now();
  };

  const emitCheckpoint = () => {
    if (!context || !sessionId || sessionEnded) return;
    const seconds = currentDurationSeconds();
    if (seconds <= lastCheckpointSeconds) return;
    lastCheckpointSeconds = seconds;
    append('session_checkpoint', { duration_seconds: seconds });
  };

  const startCheckpointTimer = () => {
    if (checkpointTimer !== null || checkpointIntervalMs <= 0) return;
    checkpointTimer = setInterval(() => {
      if (foregroundActive && !sessionEnded) tracker.checkpoint();
    }, checkpointIntervalMs);
  };

  const stopCheckpointTimer = () => {
    if (checkpointTimer === null) return;
    clearInterval(checkpointTimer);
    checkpointTimer = null;
  };

  const startSession = () => {
    if (!context || sessionId || !foregroundActive) return;
    sessionId = makeId();
    foregroundDurationMs = 0;
    foregroundStartedAt = now();
    lastCheckpointSeconds = -1;
    sessionEnded = false;
    emittedScreen = null;
    append('app_open');
    append('session_start');
    emitScreen();
    startCheckpointTimer();
  };

  const applyPlatformForeground = () => tracker.setForeground(documentVisible && nativeActive);

  const tracker: AnalyticsTracker = {
    configure(nextContext) {
      if (!nextContext) {
        tracker.setWorldView(null);
        tracker.endSession();
        context = null;
        sessionId = null;
        desiredScreen = null;
        emittedScreen = null;
        queueActorId = null;
        queue = [];
        queueGeneration += 1;
        return;
      }

      const hadContext = context !== null;
      const actorChanged = context?.userId !== nextContext.userId;
      const childChanged = hadContext && context?.childProfileId !== nextContext.childProfileId;
      if (actorChanged || childChanged) {
        tracker.setWorldView(null);
        tracker.endSession();
        queueGeneration += 1;
        if (actorChanged) {
          queueActorId = nextContext.userId;
          queue = loadQueue(nextContext.userId);
        }
        context = nextContext;
        sessionId = null;
        if (hadContext) desiredScreen = null;
        emittedScreen = null;
      } else {
        context = nextContext;
        if (queueActorId !== nextContext.userId) {
          queueActorId = nextContext.userId;
          queue = loadQueue(nextContext.userId);
        }
      }
      tracker.bindLifecycle();
      startSession();
      if (autoFlush) void tracker.flush();
    },

    track(eventName, properties) {
      append(eventName, properties);
    },

    screen(screenName) {
      const normalized = screenName.trim().slice(0, MAX_STRING_LENGTH);
      if (!normalized) return;
      desiredScreen = normalized;
      emitScreen();
    },

    checkpoint() {
      checkpointWorldSegment();
      emitCheckpoint();
    },

    setForeground(isForeground) {
      if (foregroundActive === isForeground) return;
      foregroundActive = isForeground;
      if (!isForeground) {
        closeForegroundSegment();
        checkpointWorldSegment();
        emitCheckpoint();
        return;
      }
      if (!context) return;
      if (!sessionId || sessionEnded) {
        startSession();
        return;
      }
      foregroundStartedAt = now();
      if (worldView?.visible && worldView.startedAt === null) worldView.startedAt = now();
      append('app_open');
      emittedScreen = null;
      emitScreen();
      if (autoFlush) void tracker.flush();
    },

    setWorldView(view) {
      if (worldView?.key === view?.key) {
        if (view) {
          const wasVisible = worldView.visible;
          if (wasVisible !== view.visible) tracker.setWorldViewVisible(view.visible);
          if (worldView) worldView = { ...worldView, ...view };
        }
        return;
      }
      closeWorldView();
      if (!view || !context || !sessionId || sessionEnded) return;
      worldView = { ...view, startedAt: view.visible && foregroundActive ? now() : null };
      append('world_enter', {
        location: view.location ?? view.scene,
        scene: view.scene,
        ...(view.target ? { target: view.target } : {}),
      });
      append('scene_enter', { scene: view.scene });
    },

    setWorldViewVisible(visible) {
      if (!worldView || worldView.visible === visible) return;
      if (!visible) closeWorldSegment();
      worldView.visible = visible;
      if (visible && foregroundActive) worldView.startedAt = now();
    },

    endSession() {
      if (!context || !sessionId || sessionEnded) return;
      closeWorldView();
      closeForegroundSegment();
      emitCheckpoint();
      append('session_end', { duration_seconds: currentDurationSeconds() });
      sessionEnded = true;
      sessionId = null;
      stopCheckpointTimer();
      if (autoFlush) void tracker.flush();
    },

    async flush() {
      if (!context || !queueActorId || queue.length === 0 || disposed) return;
      if (flushInFlight) return flushInFlight;
      const batchActorId = queueActorId;
      const batchGeneration = queueGeneration;
      if (context.userId !== batchActorId) return;
      queue = queue.filter((event) => event.actor_profile_id === batchActorId).slice(-MAX_QUEUE_SIZE);
      persistQueue();
      const batch = queue.slice(0, 50);
      if (batch.length === 0) return;
      const batchIds = new Set(batch.map((event) => event.event_id));
      flushInFlight = (async () => {
        try {
          await transport(batch);
          flushFailureCount = 0;
          if (queueGeneration === batchGeneration && queueActorId === batchActorId && context?.userId === batchActorId) {
            queue = queue.filter((event) => !batchIds.has(event.event_id));
            persistQueue();
            if (queue.length > 0) scheduleFlush(0);
          }
        } catch (error) {
          // Keep event IDs for a retry, but never spin at 0ms on a rejected
          // request. Permanent 4xx errors wait for an explicit next attempt.
          if (isAnalyticsRetryable(error)) {
            flushFailureCount = Math.min(flushFailureCount + 1, 3);
            scheduleFlush(Math.min(5_000, 1_000 * (2 ** flushFailureCount)));
          }
        } finally {
          flushInFlight = null;
          if (autoFlush && queue.length > 0 && context && flushFailureCount === 0) scheduleFlush(0);
        }
      })();
      return flushInFlight;
    },

    bindLifecycle() {
      if (lifecycleBound || typeof window === 'undefined' || typeof document === 'undefined') return;
      lifecycleBound = true;
      documentVisible = document.visibilityState !== 'hidden';
      foregroundActive = documentVisible && nativeActive;
      document.addEventListener('click', (event) => {
        const target = event.target instanceof Element
          ? event.target.closest<HTMLElement>('button, a, [role="button"]')
          : null;
        const control = getStaticAnalyticsControlId(target);
        if (control) tracker.track('button_click', { control });
      }, true);
      document.addEventListener('visibilitychange', () => {
        documentVisible = document.visibilityState !== 'hidden';
        applyPlatformForeground();
      });
      window.addEventListener('pagehide', () => {
        tracker.endSession();
        documentVisible = false;
        applyPlatformForeground();
      });
      window.addEventListener('pageshow', () => {
        documentVisible = true;
        applyPlatformForeground();
      });
      window.addEventListener('online', () => { void tracker.flush(); });
      if (Capacitor.isNativePlatform()) {
        void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
          nativeActive = isActive;
          applyPlatformForeground();
        })
          .then((listener) => {
            if (disposed) void listener.remove();
            else nativeListener = listener;
          })
          .catch(() => {
            // Web visibility remains the fallback when the optional native listener is unavailable.
          });
      }
    },

    dispose() {
      disposed = true;
      if (flushTimer !== null) clearTimeout(flushTimer);
      flushTimer = null;
      stopCheckpointTimer();
      if (nativeListener) void nativeListener.remove();
      nativeListener = null;
    },
  };

  void sessionStorage;
  return tracker;
}
