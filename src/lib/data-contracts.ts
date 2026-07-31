import {
  AdventureGroup,
  AdventureGroupRow,
  ChildProfileRow,
  ChildGender,
  ChildViewModel,
  FamilyMemberRow,
  FamilyMemberViewModel,
  FamilyRow,
  FamilyViewModel,
  ProfileRow,
  ProfileViewModel,
  RewardRedemptionRow,
  RewardRedemptionViewModel,
  PointLedgerRow,
  PointLedgerViewModel,
  TaskTemplateRow,
  TaskTemplateViewModel,
  TaskRow,
  TaskCategory,
  TaskOrigin,
  Task,
  TaskViewModel,
  TaskSchedule,
  TaskScheduleRow,
  TaskTimerSession,
  TaskTimerSessionRow,
  Timestamp,
  ThemeSettings,
  UnixMilliseconds,
} from '../types';

const toUnixMilliseconds = (timestamp: Timestamp): UnixMilliseconds => Date.parse(timestamp);
const defaultCategory: TaskCategory = 'life_habit';
const defaultOrigin: TaskOrigin = 'parent_assigned';

export interface ChildProfileCreationInput {
  gender: ChildGender | string;
  characterId: string;
}

export const validateChildProfileCreation = (
  input: ChildProfileCreationInput,
): string | null => {
  if (input.gender !== 'boy' && input.gender !== 'girl') return 'gender is invalid';
  if (typeof input.characterId !== 'string' || input.characterId.trim().length === 0) {
    return 'character is required';
  }
  if (input.characterId.trim().length > 80) return 'character is invalid';
  return null;
};

const taipeiCalendarDate = (value: string | Date): string => {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

export const calculateJoinedDays = (joinedAt: Timestamp, now: Timestamp | Date = new Date()): number => {
  const joinedDate = Date.parse(joinedAt);
  const nowDate = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(joinedDate) || !Number.isFinite(nowDate)) return 1;
  const start = Date.parse(`${taipeiCalendarDate(joinedAt)}T00:00:00+08:00`);
  const end = Date.parse(`${taipeiCalendarDate(now)}T00:00:00+08:00`);
  return Math.max(1, Math.floor((end - start) / 86_400_000) + 1);
};

export const profileRowToViewModel = (row: ProfileRow): ProfileViewModel => ({
  id: row.id,
  displayName: row.display_name,
  avatarUrl: row.avatar_url,
});

const themeFromRow = (row: Pick<FamilyRow | ChildProfileRow, 'accent_color' | 'background_image_mobile_url' | 'background_image_desktop_url'>): ThemeSettings => ({
  accentColor: row.accent_color ?? null,
  mobileBackgroundImageUrl: row.background_image_mobile_url ?? null,
  desktopBackgroundImageUrl: row.background_image_desktop_url ?? null,
});

export const familyRowToViewModel = (
  row: FamilyRow,
  members: FamilyMemberViewModel[] = [],
): FamilyViewModel => ({ id: row.id, name: row.name, members, theme: themeFromRow(row) });

export const familyMemberRowToViewModel = (
  row: FamilyMemberRow,
  profile: ProfileViewModel,
): FamilyMemberViewModel => ({
  id: row.id,
  profileId: row.profile_id,
  displayName: profile.displayName,
  role: row.role,
});

export const childProfileRowToViewModel = (
  row: ChildProfileRow,
  profile?: ProfileViewModel,
): ChildViewModel => ({
  id: row.id,
  familyId: row.family_id,
  profileId: row.profile_id,
  loginName: row.login_name,
  name: profile?.displayName ?? row.display_name,
  gender: row.gender,
  characterId: row.character_id,
  joinedAt: row.joined_at,
  joinedDays: calculateJoinedDays(row.joined_at),
  points: row.points_balance,
  theme: themeFromRow(row),
});

export const taskRowToViewModel = (row: TaskRow): TaskViewModel => ({
  id: row.id,
  familyId: row.family_id,
  childProfileId: row.child_profile_id,
  templateId: row.template_id,
  name: row.name,
  points: row.points,
  status: row.status,
  icon: row.icon,
  duration: row.duration_minutes,
  timerEndTime: null,
  timerRemainingMs: null,
  timerIsRunning: false,
  isDaily: row.is_daily,
  dueOn: row.due_on,
  dueTime: row.due_time,
  endTime: row.end_time,
  requiresReviewBeforeNextTask: row.requires_review_before_next_task ?? false,
  category: row.category ?? defaultCategory,
  origin: row.origin ?? defaultOrigin,
  originalName: row.original_name ?? null,
  originalPoints: row.original_points ?? null,
  confirmedAt: row.confirmed_at ?? null,
  confirmedBy: row.confirmed_by ?? null,
  submittedAt: row.submitted_at ?? null,
  reviewedAt: row.reviewed_at ?? null,
  reviewedBy: row.reviewed_by ?? null,
  approvedPoints: row.approved_points ?? null,
  reflection: row.child_reflection_text ?? null,
  mood: row.child_mood ?? null,
  difficulty: row.child_difficulty ?? null,
  parentFeedback: row.parent_feedback_text ?? null,
  parentCorrection: row.parent_correction_text ?? null,
  feedbackTone: row.feedback_tone ?? null,
  revisionNote: row.revision_note ?? null,
  completedAt: row.completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  ...(row.description !== undefined ? { description: row.description } : {}),
  ...(row.adventure_type !== undefined ? { adventureType: row.adventure_type } : {}),
  ...(row.adventure_group_id !== undefined ? { adventureGroupId: row.adventure_group_id } : {}),
  ...(row.schedule_id !== undefined ? { scheduleId: row.schedule_id } : {}),
  ...(row.occurrence_date !== undefined ? { occurrenceDate: row.occurrence_date } : {}),
  ...(row.completion_report_mode !== undefined ? { completionReportMode: row.completion_report_mode } : {}),
  ...(row.quick_report !== undefined ? { quickReport: row.quick_report } : {}),
  ...(row.requires_timer !== undefined ? { requiresTimer: row.requires_timer } : {}),
});

export const adventureGroupRowToViewModel = (row: AdventureGroupRow): AdventureGroup => ({
  id: row.id,
  familyId: row.family_id,
  childProfileId: row.child_profile_id,
  type: row.type,
  title: row.title,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  archivedAt: row.archived_at,
});

export const taskScheduleRowToViewModel = (row: TaskScheduleRow): TaskSchedule => ({
  id: row.id,
  familyId: row.family_id,
  childProfileId: row.child_profile_id,
  name: row.name,
  description: row.description,
  points: row.points,
  icon: row.icon,
  category: row.category,
  durationMinutes: row.duration_minutes,
  startTime: row.start_time,
  endTime: row.end_time,
  weekdays: row.weekdays,
  timezone: row.timezone,
  requiresTimer: row.requires_timer,
  requiresReviewBeforeNextTask: row.requires_review_before_next_task,
  activeFrom: row.active_from,
  activeUntil: row.active_until,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const taskTimerSessionRowToViewModel = (row: TaskTimerSessionRow): TaskTimerSession => ({
  id: row.id,
  familyId: row.family_id,
  childProfileId: row.child_profile_id,
  taskId: row.task_id,
  status: row.status,
  accumulatedSeconds: row.accumulated_seconds,
  startedAt: row.started_at,
  lastResumedAt: row.last_resumed_at,
  pausedAt: row.paused_at,
  completedAt: row.completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const applyServerTimerSession = (
  task: Task,
  session: TaskTimerSession,
  now = Date.now(),
): Task => {
  const runningSeconds = session.status === 'running' && session.lastResumedAt
    ? Math.max(0, Math.floor((now - Date.parse(session.lastResumedAt)) / 1_000))
    : 0;
  const elapsedSeconds = session.accumulatedSeconds + runningSeconds;
  const remainingMs = Math.max(0, (task.duration ?? 0) * 60_000 - elapsedSeconds * 1_000);
  const isRunning = session.status === 'running' && remainingMs > 0;
  return {
    ...task,
    timerIsRunning: isRunning,
    timerEndTime: isRunning ? now + remainingMs : null,
    timerRemainingMs: isRunning ? null : remainingMs,
  };
};

export const taskTemplateRowToViewModel = (
  row: TaskTemplateRow,
): TaskTemplateViewModel => ({
  id: row.id,
  name: row.name,
  points: row.points,
  duration: row.duration_minutes,
  icon: row.icon,
  category: row.category ?? defaultCategory,
  suggestedEvidence: row.suggested_evidence ?? 'reflection',
  dueTime: row.due_time ?? null,
  endTime: row.end_time ?? null,
  requiresReviewBeforeNextTask: row.requires_review_before_next_task ?? false,
});

export const redemptionRowToViewModel = (
  row: RewardRedemptionRow,
): RewardRedemptionViewModel => ({
  id: row.id,
  rewardId: row.reward_id,
  rewardName: row.reward_name,
  rewardIcon: row.reward_icon,
  pointsCost: row.points_cost,
  status: row.status,
  createdAt: toUnixMilliseconds(row.created_at),
});

export const pointLedgerRowToViewModel = (
  row: PointLedgerRow,
): PointLedgerViewModel => ({
  id: row.id,
  childProfileId: row.child_profile_id,
  pointsDelta: row.points_delta,
  entryType: row.entry_type,
  note: row.note,
  createdAt: toUnixMilliseconds(row.created_at),
});
