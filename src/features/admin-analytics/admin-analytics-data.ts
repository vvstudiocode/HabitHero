import { getSupabaseClient } from '../../lib/supabase';

export interface AdminChildSummary {
  child_profile_id: string;
  child_name: string;
  family_name: string;
  planned_tasks: number;
  submitted_tasks: number;
  completed_tasks: number;
  task_completion_rate: number;
  timer_seconds: number;
  analytics_sessions: number;
  analytics_session_seconds: number;
  screen_views: number;
  button_clicks: number;
  tutorial_steps_seen: number;
  scenes_entered: number;
  scene_dwell_seconds: number;
  last_screen_name: string | null;
  last_known_activity_at: string | null;
}

export interface AdminFunnelRow {
  child_profile_id: string;
  child_name: string;
  adventure_type: string | null;
  category: string | null;
  planned_tasks: number;
  submitted_tasks: number;
  completed_tasks: number;
  completion_rate: number;
}

export interface AdminDailyActivity {
  activity_date: string;
  total_domain_events: number;
  total_analytics_events: number;
  active_users: number;
  domain_active_children: number;
  app_opens: number;
  sessions_started: number;
  sessions_ended: number;
  session_seconds: number;
  avg_session_seconds: number;
  screen_views: number;
  button_clicks: number;
  tutorial_steps: number;
  world_enters: number;
  scene_enters: number;
  scene_exits: number;
  scene_dwell_seconds: number;
  tasks_created: number;
  tasks_submitted: number;
  tasks_completed: number;
}

export interface AdminRetentionRow {
  cohort_date: string;
  days_since_first_open: number;
  cohort_users: number;
  retained_users: number;
  retention_rate: number;
}

export interface AdminTutorialRow {
  step_number: number;
  step_events: number;
  unique_users: number;
  skipped_events: number;
  completed_events: number;
}

export interface AdminSceneDwellRow {
  scene_name: string;
  scene_enters: number;
  scene_exits: number;
  unique_users: number;
  dwell_seconds: number;
  avg_dwell_seconds: number;
}

export interface AdminAnalyticsPayload {
  summary: AdminChildSummary[];
  funnel: AdminFunnelRow[];
  dailyActivity: AdminDailyActivity[];
  retention: AdminRetentionRow[];
  tutorial: AdminTutorialRow[];
  sceneDwell: AdminSceneDwellRow[];
}

type JsonRecord = Record<string, unknown>;

const emptyPayload: AdminAnalyticsPayload = {
  summary: [],
  funnel: [],
  dailyActivity: [],
  retention: [],
  tutorial: [],
  sceneDwell: [],
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function asNumber(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === 'string' && value ? value : null;
}

export function parseAdminAnalyticsPayload(value: unknown): AdminAnalyticsPayload {
  const payload = asRecord(value);
  return {
    summary: asArray(payload.summary).map((row) => ({
      child_profile_id: asString(row.child_profile_id),
      child_name: asString(row.child_name, '未命名孩子'),
      family_name: asString(row.family_name, '未命名家庭'),
      planned_tasks: asNumber(row.planned_tasks),
      submitted_tasks: asNumber(row.submitted_tasks),
      completed_tasks: asNumber(row.completed_tasks),
      task_completion_rate: asNumber(row.task_completion_rate),
      timer_seconds: asNumber(row.timer_seconds),
      analytics_sessions: asNumber(row.analytics_sessions),
      analytics_session_seconds: asNumber(row.analytics_session_seconds),
      screen_views: asNumber(row.screen_views),
      button_clicks: asNumber(row.button_clicks),
      tutorial_steps_seen: asNumber(row.tutorial_steps_seen),
      scenes_entered: asNumber(row.scenes_entered),
      scene_dwell_seconds: asNumber(row.scene_dwell_seconds),
      last_screen_name: asNullableString(row.last_screen_name),
      last_known_activity_at: asNullableString(row.last_known_activity_at),
    })),
    funnel: asArray(payload.funnel).map((row) => ({
      child_profile_id: asString(row.child_profile_id),
      child_name: asString(row.child_name, '未命名孩子'),
      adventure_type: asNullableString(row.adventure_type),
      category: asNullableString(row.category),
      planned_tasks: asNumber(row.planned_tasks),
      submitted_tasks: asNumber(row.submitted_tasks),
      completed_tasks: asNumber(row.completed_tasks),
      completion_rate: asNumber(row.completion_rate),
    })),
    dailyActivity: asArray(payload.dailyActivity).map((row) => ({
      activity_date: asString(row.activity_date),
      total_domain_events: asNumber(row.total_domain_events),
      total_analytics_events: asNumber(row.total_analytics_events),
      active_users: asNumber(row.active_users),
      domain_active_children: asNumber(row.domain_active_children),
      app_opens: asNumber(row.app_opens),
      sessions_started: asNumber(row.sessions_started),
      sessions_ended: asNumber(row.sessions_ended),
      session_seconds: asNumber(row.session_seconds),
      avg_session_seconds: asNumber(row.avg_session_seconds),
      screen_views: asNumber(row.screen_views),
      button_clicks: asNumber(row.button_clicks),
      tutorial_steps: asNumber(row.tutorial_steps),
      world_enters: asNumber(row.world_enters),
      scene_enters: asNumber(row.scene_enters),
      scene_exits: asNumber(row.scene_exits),
      scene_dwell_seconds: asNumber(row.scene_dwell_seconds),
      tasks_created: asNumber(row.tasks_created),
      tasks_submitted: asNumber(row.tasks_submitted),
      tasks_completed: asNumber(row.tasks_completed),
    })),
    retention: asArray(payload.retention).map((row) => ({
      cohort_date: asString(row.cohort_date),
      days_since_first_open: asNumber(row.days_since_first_open),
      cohort_users: asNumber(row.cohort_users),
      retained_users: asNumber(row.retained_users),
      retention_rate: asNumber(row.retention_rate),
    })),
    tutorial: asArray(payload.tutorial).map((row) => ({
      step_number: asNumber(row.step_number),
      step_events: asNumber(row.step_events),
      unique_users: asNumber(row.unique_users),
      skipped_events: asNumber(row.skipped_events),
      completed_events: asNumber(row.completed_events),
    })),
    sceneDwell: asArray(payload.sceneDwell).map((row) => ({
      scene_name: asString(row.scene_name, '未命名場景'),
      scene_enters: asNumber(row.scene_enters),
      scene_exits: asNumber(row.scene_exits),
      unique_users: asNumber(row.unique_users),
      dwell_seconds: asNumber(row.dwell_seconds),
      avg_dwell_seconds: asNumber(row.avg_dwell_seconds),
    })),
  };
}

export async function fetchAdminAnalytics() {
  const { data, error } = await getSupabaseClient().rpc('get_admin_analytics');
  if (error) throw error;
  return parseAdminAnalyticsPayload(data ?? emptyPayload);
}
