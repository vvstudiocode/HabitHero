import type {
  AdventureCompletionInput,
  AdventureScheduleInput,
  AdventureScheduleUpdateInput,
  BatchAdventureReviewResult,
  DataRepository,
  GeneralAdventureInput,
  ReviewTaskCompletionInput,
} from './data-access';
import type { AppState, Task, TaskSchedule } from '../types';
import {
  drainAdventureCompletionQueue,
  enqueueAdventureCompletion,
  isTransientAdventureSyncError,
} from './adventure-offline-queue';

type Mutate = <T>(
  operation: (repository: DataRepository, familyId: string) => Promise<T>,
  optimisticUpdate?: (previous: AppState) => AppState,
) => Promise<T>;

export interface AdventureStoreActionDependencies {
  mutate: Mutate;
  familyId: string | null;
  getState: () => AppState;
  setState: (updater: (current: AppState) => AppState) => void;
  createLocalId: () => string;
  authenticatedUserId: string | null;
  isOnline: () => boolean;
  setError: (message: string | null) => void;
}

const patchTask = (
  previous: AppState,
  taskId: string,
  update: (task: Task) => Task,
): AppState => ({
  ...previous,
  children: previous.children.map((child) => ({
    ...child,
    tasks: child.tasks.map((task) => task.id === taskId ? update(task) : task),
  })),
});

const patchSchedule = (
  schedule: TaskSchedule,
  updates: AdventureScheduleUpdateInput,
): TaskSchedule => ({
  ...schedule,
  ...(updates.name !== undefined ? { name: updates.name } : {}),
  ...(updates.description !== undefined ? { description: updates.description } : {}),
  ...(updates.points !== undefined ? { points: updates.points } : {}),
  ...(updates.icon !== undefined ? { icon: updates.icon } : {}),
  ...(updates.category !== undefined ? { category: updates.category } : {}),
  ...(updates.durationMinutes !== undefined ? { durationMinutes: updates.durationMinutes } : {}),
  ...(updates.startTime !== undefined ? { startTime: updates.startTime } : {}),
  ...(updates.endTime !== undefined ? { endTime: updates.endTime } : {}),
  ...(updates.weekdays !== undefined ? { weekdays: updates.weekdays } : {}),
  ...(updates.timezone !== undefined ? { timezone: updates.timezone } : {}),
  ...(updates.requiresTimer !== undefined ? { requiresTimer: updates.requiresTimer } : {}),
  ...(updates.requiresReviewBeforeNextTask !== undefined
    ? { requiresReviewBeforeNextTask: updates.requiresReviewBeforeNextTask }
    : {}),
  ...(updates.activeFrom !== undefined ? { activeFrom: updates.activeFrom } : {}),
  ...(updates.activeUntil !== undefined ? { activeUntil: updates.activeUntil } : {}),
  updatedAt: new Date().toISOString(),
});

const getDateKeyInTimezone = (now: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
};

const getIsoWeekday = (dateKey: string) => {
  const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
};

export function createAdventureStoreActions({
  mutate,
  familyId,
  getState,
  setState,
  createLocalId,
  authenticatedUserId,
  isOnline,
  setError,
}: AdventureStoreActionDependencies) {
  const optimisticCompletion = (
    previous: AppState,
    taskId: string,
    submission: AdventureCompletionInput,
    pendingSync: boolean,
  ) => patchTask(previous, taskId, (task) => ({
    ...task,
    status: 'pending',
    pendingSync,
    quickReport: submission.quickReport ?? null,
    reflection: submission.reflection ?? null,
    mood: submission.mood ?? null,
    difficulty: submission.difficulty ?? null,
    submittedAt: new Date().toISOString(),
  }));

  return {
    ensureDailyAdventureOccurrences: (childId: string, date?: string) =>
      mutate((repository) => repository.ensureDailyAdventureOccurrences(childId, date)),

    submitAdventureCompletion: async (taskId: string, submission: AdventureCompletionInput) => {
      if (!isOnline()) {
        if (!authenticatedUserId) throw new Error('尚未登入，無法保存離線完成。');
        const current = getState();
        const owner = current.children.find((child) => child.tasks.some((task) => task.id === taskId));
        const task = owner?.tasks.find((candidate) => candidate.id === taskId);
        if (!owner || !task) throw new Error('找不到要完成的冒險。');
        const queuedAt = new Date().toISOString();
        enqueueAdventureCompletion({
          ownerUserId: authenticatedUserId,
          childProfileId: owner.id,
          taskId,
          submission,
          previous: {
            status: task.status,
            quickReport: task.quickReport ?? null,
            reflection: task.reflection ?? null,
            mood: task.mood ?? null,
            difficulty: task.difficulty ?? null,
            submittedAt: task.submittedAt ?? null,
          },
          queuedAt,
        });
        setState((previous) => optimisticCompletion(previous, taskId, submission, true));
        return;
      }
      return mutate(
        (repository) => repository.submitAdventureCompletion(taskId, submission),
        (previous) => optimisticCompletion(previous, taskId, submission, false),
      );
    },

    flushAdventureCompletionQueue: async () => {
      if (!authenticatedUserId || !isOnline()) return;
      const result = await drainAdventureCompletionQueue(
        authenticatedUserId,
        async (entry) => {
          const child = getState().children.find((candidate) => candidate.id === entry.childProfileId);
          if (!child?.tasks.some((task) => task.id === entry.taskId)) {
            throw new Error('離線冒險已不在目前帳號中。');
          }
          await mutate((repository) =>
            repository.submitAdventureCompletion(entry.taskId, entry.submission));
        },
        undefined,
        isTransientAdventureSyncError,
      );
      const permanentFailures = result.failures.filter((failure) => !failure.retryable);
      const failures = new Map(permanentFailures.map((failure) => [failure.entry.taskId, failure]));
      const succeeded = new Set(result.succeededTaskIds);
      setState((current) => ({
        ...current,
        children: current.children.map((child) => ({
          ...child,
          tasks: child.tasks.map((task) => {
            if (succeeded.has(task.id)) return { ...task, pendingSync: false };
            const failure = failures.get(task.id);
            if (!failure || failure.entry.childProfileId !== child.id) return task;
            const previous = failure.entry.previous;
            return {
              ...task,
              status: previous.status,
              pendingSync: false,
              quickReport: previous.quickReport,
              reflection: previous.reflection,
              mood: previous.mood,
              difficulty: previous.difficulty,
              submittedAt: previous.submittedAt,
            };
          }),
        })),
      }));
      if (permanentFailures.length > 0) {
        setError(`冒險同步失敗：${permanentFailures[0].message}`);
      } else if (result.failures.length > 0) {
        setError(null);
      } else if (result.succeededTaskIds.length > 0) {
        setError(null);
      }
    },

    reviewAdventureCompletion: (taskId: string, review: ReviewTaskCompletionInput) =>
      mutate(
        (repository) => repository.reviewAdventureCompletion(taskId, review),
        (previous) => {
          const reviewedAt = new Date().toISOString();
          return {
            ...previous,
            children: previous.children.map((child) => {
              const target = child.tasks.find((task) => task.id === taskId);
              const shouldAward = Boolean(review.approved && target && target.status !== 'completed');
              return {
                ...child,
                points: shouldAward ? child.points + review.approvedPoints : child.points,
                tasks: child.tasks.map((task) => task.id !== taskId ? task : {
                  ...task,
                  status: review.approved ? 'completed' : 'revision_requested',
                  approvedPoints: review.approved ? review.approvedPoints : null,
                  parentFeedback: review.feedback ?? null,
                  parentCorrection: review.correction ?? null,
                  feedbackTone: review.tone ?? null,
                  revisionNote: review.revisionNote ?? null,
                  reviewedAt,
                  completedAt: review.approved ? reviewedAt : null,
                }),
              };
            }),
          };
        },
      ),

    createAdventureSchedule: (input: AdventureScheduleInput) => {
      const now = new Date().toISOString();
      const occurrenceDate = getDateKeyInTimezone(new Date(), input.timezone ?? 'Asia/Taipei');
      const createsToday = input.activeFrom <= occurrenceDate
        && (!input.activeUntil || input.activeUntil >= occurrenceDate)
        && input.weekdays.includes(getIsoWeekday(occurrenceDate));
      const schedules: TaskSchedule[] = input.childProfileIds.map((childProfileId) => ({
        id: createLocalId(),
        familyId: familyId ?? '',
        childProfileId,
        name: input.name,
        description: input.description ?? null,
        points: input.points,
        icon: input.icon,
        category: input.category,
        durationMinutes: input.durationMinutes ?? null,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        weekdays: input.weekdays,
        timezone: input.timezone ?? 'Asia/Taipei',
        requiresTimer: input.requiresTimer ?? false,
        requiresReviewBeforeNextTask: input.requiresReviewBeforeNextTask ?? false,
        activeFrom: input.activeFrom,
        activeUntil: input.activeUntil ?? null,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }));
      return mutate(
        (repository, id) => repository.createAdventureSchedule(id, input).then(() => undefined),
        (previous) => ({
          ...previous,
          taskSchedules: [...(previous.taskSchedules ?? []), ...schedules],
          children: previous.children.map((child) => {
            const schedule = schedules.find((candidate) => candidate.childProfileId === child.id);
            if (!createsToday || !schedule) return child;
            return {
              ...child,
              tasks: [...child.tasks, {
                id: createLocalId(),
                name: input.name,
                description: input.description ?? null,
                points: input.points,
                icon: input.icon,
                status: 'todo',
                isDaily: true,
                adventureType: 'daily',
                scheduleId: schedule.id,
                occurrenceDate,
                completionReportMode: 'none',
                requiresTimer: input.requiresTimer ?? false,
                requiresReviewBeforeNextTask: false,
                category: input.category,
                origin: 'parent_assigned',
                duration: input.durationMinutes ?? undefined,
                dueOn: occurrenceDate,
                dueTime: input.startTime ?? null,
                endTime: input.endTime ?? null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
              } as Task],
            };
          }),
        }),
      );
    },

    updateAdventureSchedule: async (scheduleId: string, updates: AdventureScheduleUpdateInput) => {
      const updated = await mutate(
        (repository) => repository.updateAdventureSchedule(scheduleId, updates),
      );
      setState((previous) => {
        if (updates.applyMode === 'today_unfinished') return previous;
        const schedules = previous.taskSchedules ?? [];
        if ((updates.applyMode ?? 'from_tomorrow') === 'from_tomorrow' && updated.id !== scheduleId) {
          return {
            ...previous,
            taskSchedules: [
              ...schedules.map((schedule) => schedule.id === scheduleId
                ? { ...schedule, isActive: false, updatedAt: updated.updatedAt }
                : schedule),
              updated,
            ],
          };
        }
        return {
          ...previous,
          taskSchedules: schedules.map((schedule) =>
            schedule.id === scheduleId ? patchSchedule(updated, updates) : schedule),
        };
      });
    },

    disableAdventureSchedule: (scheduleId: string) =>
      mutate(
        (repository) => repository.disableAdventureSchedule(scheduleId),
        (previous) => ({
          ...previous,
          taskSchedules: (previous.taskSchedules ?? []).map((schedule) => schedule.id === scheduleId
            ? { ...schedule, isActive: false, updatedAt: new Date().toISOString() }
            : schedule),
        }),
      ),

    createGeneralAdventure: (input: GeneralAdventureInput) =>
      mutate(
        (repository, id) => repository.createGeneralAdventure(id, input).then(() => undefined),
        (previous) => {
          const now = new Date().toISOString();
          return {
            ...previous,
            children: previous.children.map((child) => !input.childProfileIds.includes(child.id) ? child : {
              ...child,
              tasks: [...child.tasks, {
                id: createLocalId(),
                name: input.name,
                description: input.description ?? null,
                points: input.points,
                icon: input.icon,
                status: 'todo',
                adventureType: 'general',
                completionReportMode: input.reportMode,
                requiresTimer: input.requiresTimer ?? false,
                requiresReviewBeforeNextTask: input.requiresReviewBeforeNextTask ?? false,
                category: input.category,
                origin: 'parent_assigned',
                duration: input.durationMinutes ?? undefined,
                dueOn: input.dueOn ?? null,
                dueTime: input.startTime ?? null,
                endTime: input.endTime ?? null,
                createdAt: now,
                updatedAt: now,
                completedAt: null,
              } as Task],
            }),
          };
        },
      ),

    updateGeneralAdventureTitle: (childId: string, title: string) =>
      mutate(
        (repository, id) => repository.updateGeneralAdventureTitle(id, childId, title).then(() => undefined),
        (previous) => {
          const groups = previous.adventureGroups ?? [];
          const active = groups.find((group) => group.childProfileId === childId && group.status === 'active');
          const now = new Date().toISOString();
          return {
            ...previous,
            adventureGroups: active
              ? groups.map((group) => group.id === active.id ? { ...group, title, updatedAt: now } : group)
              : [...groups, {
                id: createLocalId(),
                familyId: familyId ?? '',
                childProfileId: childId,
                type: 'general',
                title,
                status: 'active',
                createdAt: now,
                updatedAt: now,
                archivedAt: null,
              }],
          };
        },
      ),

    archiveAdventureGroup: (groupId: string) =>
      mutate(
        (repository) => repository.archiveAdventureGroup(groupId),
        (previous) => ({
          ...previous,
          adventureGroups: (previous.adventureGroups ?? []).map((group) => group.id === groupId
            ? { ...group, status: 'archived', archivedAt: new Date().toISOString() }
            : group),
        }),
      ),

    startAdventureTimer: (taskId: string) =>
      mutate(
        (repository) => repository.startAdventureTimer(taskId).then(() => undefined),
        (previous) => patchTask(previous, taskId, (task) => ({
          ...task,
          timerIsRunning: true,
          timerRemainingMs: null,
          timerEndTime: Date.now() + (task.timerRemainingMs ?? (task.duration ?? 0) * 60_000),
        })),
      ),

    pauseAdventureTimer: (taskId: string) =>
      mutate(
        (repository) => repository.pauseAdventureTimer(taskId).then(() => undefined),
        (previous) => patchTask(previous, taskId, (task) => ({
          ...task,
          timerIsRunning: false,
          timerRemainingMs: task.timerEndTime
            ? Math.max(0, task.timerEndTime - Date.now())
            : task.timerRemainingMs,
          timerEndTime: null,
        })),
      ),

    resumeAdventureTimer: (taskId: string) =>
      mutate(
        (repository) => repository.resumeAdventureTimer(taskId).then(() => undefined),
        (previous) => patchTask(previous, taskId, (task) => ({
          ...task,
          timerIsRunning: true,
          timerEndTime: Date.now() + (task.timerRemainingMs ?? 0),
          timerRemainingMs: null,
        })),
      ),

    batchReviewDailyAdventures: async (taskIds: string[]): Promise<BatchAdventureReviewResult> => {
      const before = getState();
      const selected = new Set(taskIds);
      const result = await mutate(
        (repository) => repository.batchReviewDailyAdventures(taskIds),
        (previous) => {
          const reviewedAt = new Date().toISOString();
          return {
            ...previous,
            children: previous.children.map((child) => {
              const awarded = child.tasks.reduce((sum, task) =>
                selected.has(task.id) && task.status === 'pending' && task.adventureType === 'daily'
                  ? sum + task.points
                  : sum, 0);
              return {
                ...child,
                points: child.points + awarded,
                tasks: child.tasks.map((task) =>
                  selected.has(task.id) && task.status === 'pending' && task.adventureType === 'daily'
                    ? { ...task, status: 'completed', approvedPoints: task.points, reviewedAt, completedAt: reviewedAt }
                    : task),
              };
            }),
          };
        },
      );
      if (result.failedTaskIds.length === 0) return result;

      const failed = new Set(result.failedTaskIds);
      setState((current) => ({
        ...current,
        children: current.children.map((child) => {
          const original = before.children.find((candidate) => candidate.id === child.id);
          if (!original) return child;
          const restored = new Map(original.tasks.filter((task) => failed.has(task.id)).map((task) => [task.id, task]));
          const pointsToRestore = original.tasks.reduce((sum, task) =>
            failed.has(task.id) && task.status === 'pending' && task.adventureType === 'daily'
              ? sum + task.points
              : sum, 0);
          return {
            ...child,
            points: child.points - pointsToRestore,
            tasks: child.tasks.map((task) => restored.get(task.id) ?? task),
          };
        }),
      }));
      return result;
    },
  };
}
