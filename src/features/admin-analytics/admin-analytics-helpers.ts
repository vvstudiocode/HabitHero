import type { AdminDailyActivity, AdminRetentionRow } from './admin-analytics-data';

export const ADMIN_ANALYTICS_TIME_ZONE = 'Asia/Taipei';

const dateKeyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ADMIN_ANALYTICS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function dateParts(value: Date | number) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dateKeyFormatter.formatToParts(date).reduce<Record<string, string>>((parts, part) => {
    if (part.type !== 'literal') parts[part.type] = part.value;
    return parts;
  }, {});
}

export function getTaipeiDateKey(value: Date | number = new Date()) {
  const parts = dateParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
}

function dateKeyToUtc(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) return null;
  return timestamp;
}

export function shiftAdminDateKey(value: string, days: number) {
  const timestamp = dateKeyToUtc(value);
  if (timestamp === null) return '';
  const shifted = new Date(timestamp + Math.trunc(days) * 24 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function getAdminCalendarDateKeys(range: number, today = getTaipeiDateKey()) {
  const safeRange = Math.max(1, Math.trunc(range));
  const firstDay = shiftAdminDateKey(today, -(safeRange - 1));
  if (!firstDay) return [];
  return Array.from({ length: safeRange }, (_, index) => shiftAdminDateKey(firstDay, index));
}

const emptyDailyActivity = (activity_date: string): AdminDailyActivity => ({
  activity_date,
  total_domain_events: 0,
  total_analytics_events: 0,
  active_users: 0,
  domain_active_children: 0,
  app_opens: 0,
  sessions_started: 0,
  sessions_ended: 0,
  session_seconds: 0,
  avg_session_seconds: 0,
  screen_views: 0,
  button_clicks: 0,
  tutorial_steps: 0,
  world_enters: 0,
  scene_enters: 0,
  scene_exits: 0,
  scene_dwell_seconds: 0,
  tasks_created: 0,
  tasks_submitted: 0,
  tasks_completed: 0,
});

export function fillAdminDailyActivityCalendar(rows: AdminDailyActivity[], range: number, today = getTaipeiDateKey()) {
  const rowsByDate = new Map(rows.map((row) => [row.activity_date, row]));
  return getAdminCalendarDateKeys(range, today).map((date) => rowsByDate.get(date) ?? emptyDailyActivity(date));
}

export function getAdminObservedSessionCount(rows: AdminDailyActivity[]) {
  const hasObservedField = rows.some((row) => row.sessions_observed !== undefined);
  return hasObservedField
    ? rows.reduce((total, row) => total + Number(row.sessions_observed ?? 0), 0)
    : rows.reduce((total, row) => total + row.sessions_ended, 0);
}

export function isAdminRetentionRowMature(row: AdminRetentionRow, today = getTaipeiDateKey()) {
  if (!row.cohort_date || row.cohort_users <= 0 || row.days_since_first_open < 0) return false;
  const retentionDay = shiftAdminDateKey(row.cohort_date, row.days_since_first_open);
  return Boolean(retentionDay && retentionDay < today);
}

export function getLatestEligibleRetentionRow(rows: AdminRetentionRow[], daysSinceFirstOpen: number, today = getTaipeiDateKey()) {
  return rows
    .filter((row) => row.days_since_first_open === daysSinceFirstOpen && isAdminRetentionRowMature(row, today))
    .sort((left, right) => left.cohort_date.localeCompare(right.cohort_date))
    .at(-1);
}

export function formatAdminDuration(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  if (safeSeconds < 60) return `${safeSeconds} 秒`;
  const totalMinutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return minutes > 0 ? `${hours} 小時 ${minutes} 分` : `${hours} 小時`;
  return remainingSeconds > 0 ? `${minutes} 分 ${remainingSeconds} 秒` : `${minutes} 分`;
}

export function resolveAdminAnalyticsDisplayError(loadError: string, sessionError: string | null | undefined) {
  return loadError || sessionError || '';
}

export function isCurrentAdminAnalyticsRequest(
  requestId: number,
  currentRequestId: number,
  requestUserId: string | null,
  currentUserId: string | null,
) {
  return requestUserId !== null && requestId === currentRequestId && requestUserId === currentUserId;
}
