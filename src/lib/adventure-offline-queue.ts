import type { AdventureCompletionInput } from './adventure-data-access';
import type { AdventureQuickReport, AppState, TaskStatus } from '../types';

export interface QueueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AdventureCompletionQueueEntry {
  ownerUserId: string;
  childProfileId: string;
  taskId: string;
  submission: AdventureCompletionInput;
  previous: {
    status: TaskStatus;
    quickReport: AdventureQuickReport | null;
    reflection: string | null;
    mood: string | null;
    difficulty: number | null;
    submittedAt: string | null;
  };
  queuedAt: string;
}

export interface AdventureCompletionDrainResult {
  succeededTaskIds: string[];
  failures: Array<{
    entry: AdventureCompletionQueueEntry;
    message: string;
    retryable: boolean;
  }>;
}

const memoryQueues = new Map<string, AdventureCompletionQueueEntry[]>();
const activeDrains = new Map<string, Promise<AdventureCompletionDrainResult>>();

const queueKey = (ownerUserId: string) =>
  `habithero:adventure-completion-queue:${encodeURIComponent(ownerUserId)}`;

const defaultStorage = (): QueueStorage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

const isQueueEntry = (value: unknown, ownerUserId: string): value is AdventureCompletionQueueEntry => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AdventureCompletionQueueEntry>;
  return candidate.ownerUserId === ownerUserId
    && typeof candidate.childProfileId === 'string'
    && typeof candidate.taskId === 'string'
    && typeof candidate.queuedAt === 'string'
    && Boolean(candidate.submission)
    && typeof candidate.submission?.idempotencyKey === 'string'
    && Boolean(candidate.previous);
};

export function loadAdventureCompletionQueue(
  ownerUserId: string,
  storage: QueueStorage | null = defaultStorage(),
): AdventureCompletionQueueEntry[] {
  if (!storage) return [...(memoryQueues.get(ownerUserId) ?? [])];
  try {
    const raw = storage.getItem(queueKey(ownerUserId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item) => isQueueEntry(item, ownerUserId)) : [];
  } catch {
    return [];
  }
}

function saveAdventureCompletionQueue(
  ownerUserId: string,
  entries: AdventureCompletionQueueEntry[],
  storage: QueueStorage | null,
) {
  memoryQueues.set(ownerUserId, entries);
  if (!storage) return;
  try {
    if (entries.length === 0) storage.removeItem(queueKey(ownerUserId));
    else storage.setItem(queueKey(ownerUserId), JSON.stringify(entries));
  } catch {
    // The in-memory queue remains available when storage is unavailable.
  }
}

export function enqueueAdventureCompletion(
  entry: AdventureCompletionQueueEntry,
  storage: QueueStorage | null = defaultStorage(),
) {
  const entries = loadAdventureCompletionQueue(entry.ownerUserId, storage);
  const duplicate = entries.some((queued) =>
    queued.taskId === entry.taskId
    || queued.submission.idempotencyKey === entry.submission.idempotencyKey);
  if (!duplicate) entries.push(entry);
  saveAdventureCompletionQueue(entry.ownerUserId, entries, storage);
}

export function removeAdventureCompletion(
  ownerUserId: string,
  idempotencyKey: string,
  storage: QueueStorage | null = defaultStorage(),
) {
  const entries = loadAdventureCompletionQueue(ownerUserId, storage)
    .filter((entry) => entry.submission.idempotencyKey !== idempotencyKey);
  saveAdventureCompletionQueue(ownerUserId, entries, storage);
}

export function drainAdventureCompletionQueue(
  ownerUserId: string,
  send: (entry: AdventureCompletionQueueEntry) => Promise<void>,
  storage: QueueStorage | null = defaultStorage(),
  isRetryable: (error: unknown) => boolean = () => false,
): Promise<AdventureCompletionDrainResult> {
  const current = activeDrains.get(ownerUserId);
  if (current) return current;

  const drain = (async () => {
    const result: AdventureCompletionDrainResult = { succeededTaskIds: [], failures: [] };
    for (const entry of loadAdventureCompletionQueue(ownerUserId, storage)) {
      try {
        await send(entry);
        result.succeededTaskIds.push(entry.taskId);
        removeAdventureCompletion(ownerUserId, entry.submission.idempotencyKey, storage);
      } catch (error) {
        const retryable = isRetryable(error);
        result.failures.push({
          entry,
          message: error instanceof Error ? error.message : '離線完成同步失敗。',
          retryable,
        });
        if (!retryable) {
          removeAdventureCompletion(ownerUserId, entry.submission.idempotencyKey, storage);
        }
      }
    }
    return result;
  })().finally(() => {
    activeDrains.delete(ownerUserId);
  });
  activeDrains.set(ownerUserId, drain);
  return drain;
}

export function isTransientAdventureSyncError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /network|failed to fetch|load failed|timeout|timed out|offline|網路|連線/i.test(message);
}

export function restoreQueuedAdventureCompletions(
  state: AppState,
  ownerUserId: string,
  storage: QueueStorage | null = defaultStorage(),
): AppState {
  const byTaskId = new Map(loadAdventureCompletionQueue(ownerUserId, storage)
    .map((entry) => [entry.taskId, entry]));
  return {
    ...state,
    children: state.children.map((child) => ({
      ...child,
      tasks: child.tasks.map((task) => {
        const entry = byTaskId.get(task.id);
        if (!entry || entry.childProfileId !== child.id) return task;
        return {
          ...task,
          status: 'pending',
          pendingSync: true,
          quickReport: entry.submission.quickReport ?? null,
          reflection: entry.submission.reflection ?? null,
          mood: entry.submission.mood ?? null,
          difficulty: entry.submission.difficulty ?? null,
          submittedAt: entry.queuedAt,
        };
      }),
    })),
  };
}
