import type { AdventureTask } from './types';

export interface AdventureRewardEvent {
  taskId: string;
  taskName: string;
  stars: number;
  scrolls: number;
  reviewedAt: string;
}

export interface AdventureRewardBundle {
  events: AdventureRewardEvent[];
  totalStars: number;
  totalScrolls: number;
  latestReviewedAt: string;
}

export interface AdventureRewardNoticeState {
  initialized: boolean;
  seenTaskIds: string[];
  submittedTaskIds: string[];
}

interface RewardNoticeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_PREFIX = 'habithero:adventure-reward-notice:';
const STATE_VERSION = 2;
const EMPTY_STATE: AdventureRewardNoticeState = { initialized: false, seenTaskIds: [], submittedTaskIds: [] };

function getBrowserStorage(): RewardNoticeStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function storageKey(childId: string) {
  return `${STORAGE_PREFIX}${encodeURIComponent(childId)}`;
}

function parseReviewedAt(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function toStars(task: Pick<AdventureTask, 'points' | 'approvedPoints'>) {
  const value = task.approvedPoints ?? task.points;
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function getApprovedAdventureRewardEvents(
  tasks: ReadonlyArray<Pick<AdventureTask, 'id' | 'name' | 'points' | 'approvedPoints' | 'status' | 'reviewedAt'>>,
): AdventureRewardEvent[] {
  return tasks
    .filter((task) => task.status === 'completed' && parseReviewedAt(task.reviewedAt) !== null)
    .map((task) => ({
      taskId: task.id,
      taskName: task.name,
      stars: toStars(task),
      // Every approved adventure grants one quest scroll in the server economy.
      scrolls: 1,
      reviewedAt: task.reviewedAt!,
    }))
    .sort((left, right) => parseReviewedAt(left.reviewedAt)! - parseReviewedAt(right.reviewedAt)!);
}

export function getUnseenAdventureRewardEvents(
  events: ReadonlyArray<AdventureRewardEvent>,
  seenTaskIds: ReadonlyArray<string>,
): AdventureRewardEvent[] {
  const seen = new Set(seenTaskIds);
  return events.filter((event) => !seen.has(event.taskId));
}

export function createAdventureRewardBundle(
  events: ReadonlyArray<AdventureRewardEvent>,
): AdventureRewardBundle {
  const normalized = [...events];
  const latestReviewedAt = normalized.reduce(
    (latest, event) => parseReviewedAt(event.reviewedAt)! > parseReviewedAt(latest)!
      ? event.reviewedAt
      : latest,
    normalized[0]?.reviewedAt ?? new Date(0).toISOString(),
  );
  return {
    events: normalized,
    totalStars: normalized.reduce((total, event) => total + event.stars, 0),
    totalScrolls: normalized.reduce((total, event) => total + event.scrolls, 0),
    latestReviewedAt,
  };
}

export function createInitialAdventureRewardNoticeState(
  events: ReadonlyArray<AdventureRewardEvent>,
  submittedTaskIds: ReadonlyArray<string> = [],
): AdventureRewardNoticeState {
  const submitted = [...new Set(submittedTaskIds)];
  return {
    initialized: true,
    seenTaskIds: events
      .filter((event) => !submitted.includes(event.taskId))
      .map((event) => event.taskId),
    submittedTaskIds: submitted,
  };
}

export function markAdventureRewardTaskSubmitted(
  state: AdventureRewardNoticeState,
  taskId: string,
): AdventureRewardNoticeState {
  if (!taskId) return state;
  return {
    initialized: true,
    seenTaskIds: state.seenTaskIds,
    submittedTaskIds: [...new Set([...state.submittedTaskIds, taskId])].slice(-200),
  };
}

function isLegacyState(parsed: Partial<AdventureRewardNoticeState> & { version?: number }) {
  return parsed.version !== STATE_VERSION;
}

function normalizeIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').slice(-200)
    : [];
}

function toStoredState(state: AdventureRewardNoticeState) {
  return {
    version: STATE_VERSION,
    initialized: state.initialized === true,
    seenTaskIds: [...new Set(state.seenTaskIds)].slice(-200),
    submittedTaskIds: [...new Set(state.submittedTaskIds)].slice(-200),
  };
}

function migrateStoredState(parsed: Partial<AdventureRewardNoticeState> & { version?: number }) {
  if (isLegacyState(parsed)) {
    // The first implementation marked approvals as seen before rendering them.
    // Treat legacy records as a one-time unread migration so a child cannot
    // lose a reward card merely by switching back from parent mode.
    return { ...EMPTY_STATE, initialized: true };
  }
  return {
    initialized: parsed.initialized === true,
    seenTaskIds: normalizeIds(parsed.seenTaskIds),
    submittedTaskIds: normalizeIds(parsed.submittedTaskIds),
  };
}

export function markAdventureRewardEventsSeen(
  state: AdventureRewardNoticeState,
  events: ReadonlyArray<AdventureRewardEvent>,
): AdventureRewardNoticeState {
  const seenTaskIds = new Set(events.map((event) => event.taskId));
  return {
    initialized: true,
    seenTaskIds: [...new Set([...state.seenTaskIds, ...events.map((event) => event.taskId)])].slice(-200),
    submittedTaskIds: state.submittedTaskIds.filter((taskId) => !seenTaskIds.has(taskId)),
  };
}

export function readAdventureRewardNoticeState(
  childId: string,
  storage: RewardNoticeStorage | null = getBrowserStorage(),
): AdventureRewardNoticeState {
  if (!childId || !storage) return { ...EMPTY_STATE, seenTaskIds: [], submittedTaskIds: [] };
  try {
    const raw = storage.getItem(storageKey(childId));
    if (!raw) return { ...EMPTY_STATE, seenTaskIds: [], submittedTaskIds: [] };
    const parsed = JSON.parse(raw) as Partial<AdventureRewardNoticeState> & { version?: number };
    return migrateStoredState(parsed);
  } catch {
    return { ...EMPTY_STATE, seenTaskIds: [], submittedTaskIds: [] };
  }
}

export function writeAdventureRewardNoticeState(
  childId: string,
  state: AdventureRewardNoticeState,
  storage: RewardNoticeStorage | null = getBrowserStorage(),
) {
  if (!childId || !storage) return;
  try {
    storage.setItem(storageKey(childId), JSON.stringify(toStoredState(state)));
  } catch {
    // A blocked storage should not prevent the child from seeing the reward.
  }
}
