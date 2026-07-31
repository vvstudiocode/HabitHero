import type {
  AdventureQuickReport,
  CompletionReportMode,
  TaskCategory,
  TaskSchedule,
} from '../types';

export interface AdventureCompletionInput {
  idempotencyKey: string;
  quickReport?: AdventureQuickReport | null;
  reflection?: string | null;
  mood?: string | null;
  difficulty?: number | null;
}

export interface AdventureScheduleInput {
  childProfileIds: string[];
  name: string;
  description?: string | null;
  points: number;
  icon: string;
  category: TaskCategory;
  durationMinutes?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  weekdays: number[];
  timezone?: string;
  requiresTimer?: boolean;
  requiresReviewBeforeNextTask?: boolean;
  activeFrom: string;
  activeUntil?: string | null;
}

export interface AdventureScheduleUpdateInput extends Partial<Omit<AdventureScheduleInput, 'childProfileIds'>> {
  applyMode?: 'today_unfinished' | 'from_tomorrow' | 'today_and_future';
}

export interface GeneralAdventureInput {
  childProfileIds: string[];
  name: string;
  description?: string | null;
  points: number;
  icon: string;
  category: TaskCategory;
  durationMinutes?: number | null;
  dueOn?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  reportMode: Exclude<CompletionReportMode, 'none'>;
  requiresTimer?: boolean;
  requiresReviewBeforeNextTask?: boolean;
}

export interface BatchAdventureReviewResult {
  failedTaskIds: string[];
}

export const buildAdventureCompletionPayload = (
  taskId: string,
  submission: AdventureCompletionInput,
) => ({
  target_task_id: taskId,
  idempotency_key: submission.idempotencyKey,
  quick_report: submission.quickReport ?? null,
  reflection: submission.reflection ?? null,
  mood: submission.mood ?? null,
  difficulty: submission.difficulty ?? null,
});

export const buildAdventureSchedulePayload = (
  familyId: string,
  schedule: AdventureScheduleInput,
  childProfileId: string,
) => ({
  target_family_id: familyId,
  target_child_profile_id: childProfileId,
  schedule_name: schedule.name,
  schedule_description: schedule.description ?? null,
  schedule_points: schedule.points,
  schedule_icon: schedule.icon,
  schedule_category: schedule.category,
  schedule_duration_minutes: schedule.durationMinutes ?? null,
  schedule_start_time: schedule.startTime ?? null,
  schedule_end_time: schedule.endTime ?? null,
  schedule_weekdays: schedule.weekdays,
  schedule_timezone: schedule.timezone ?? 'Asia/Taipei',
  schedule_requires_timer: schedule.requiresTimer ?? false,
  schedule_requires_review_before_next_task: schedule.requiresReviewBeforeNextTask ?? false,
  schedule_active_from: schedule.activeFrom,
  schedule_active_until: schedule.activeUntil ?? null,
});

export const buildAdventureScheduleUpdatePayload = (
  scheduleId: string,
  current: TaskSchedule,
  updates: AdventureScheduleUpdateInput,
) => ({
  target_schedule_id: scheduleId,
  schedule_name: updates.name ?? current.name,
  schedule_description: updates.description === undefined ? current.description : updates.description,
  schedule_points: updates.points ?? current.points,
  schedule_icon: updates.icon ?? current.icon,
  schedule_category: updates.category ?? current.category,
  schedule_duration_minutes: updates.durationMinutes === undefined ? current.durationMinutes : updates.durationMinutes,
  schedule_start_time: updates.startTime === undefined ? current.startTime : updates.startTime,
  schedule_end_time: updates.endTime === undefined ? current.endTime : updates.endTime,
  schedule_weekdays: updates.weekdays ?? current.weekdays,
  schedule_timezone: updates.timezone ?? current.timezone,
  schedule_requires_timer: updates.requiresTimer ?? current.requiresTimer,
  schedule_requires_review_before_next_task:
    updates.requiresReviewBeforeNextTask ?? current.requiresReviewBeforeNextTask,
  schedule_active_from: updates.activeFrom ?? current.activeFrom,
  schedule_active_until: updates.activeUntil === undefined ? current.activeUntil : updates.activeUntil,
  update_scope: updates.applyMode ?? 'from_tomorrow',
});
