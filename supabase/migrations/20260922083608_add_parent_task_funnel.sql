-- Parent task funnel: where parents drop off before publishing a task.
--
-- Steps reuse the existing analytics contract (no new event_name):
--   1. screen_view with screen LIKE 'parent:%' (already emitted by ParentDashboard)
--   2. screen_view with screen = 'parent:tasks'
--   3. button_click with control IN (parent-task-add, parent-daily-adventure-add,
--      parent-general-adventure-add) (data-analytics-id added on those buttons)
--   4. domain tasks_created from public.tasks (final success signal)
--
-- Step 4 has no actor profile on public.tasks, so unique_users there counts
-- distinct families with at least one task. The dashboard labels this step
-- in family units; steps 1-3 count distinct parent account profiles.

create or replace view private.analytics_parent_task_funnel as
with panel_view as (
  select
    count(*)::bigint as total_events,
    count(distinct event.profile_id)::bigint as unique_users,
    count(distinct event.family_id)::bigint as unique_families
  from public.analytics_events event
  where event.event_name = 'screen_view'
    and (
      nullif(event.properties ->> 'screen', '') like 'parent:%'
      or event.screen_name like 'parent:%'
    )
),
tasks_view as (
  select
    count(*)::bigint as total_events,
    count(distinct event.profile_id)::bigint as unique_users,
    count(distinct event.family_id)::bigint as unique_families
  from public.analytics_events event
  where event.event_name = 'screen_view'
    and (
      nullif(event.properties ->> 'screen', '') = 'parent:tasks'
      or event.screen_name = 'parent:tasks'
    )
),
form_open as (
  select
    count(*)::bigint as total_events,
    count(distinct event.profile_id)::bigint as unique_users,
    count(distinct event.family_id)::bigint as unique_families
  from public.analytics_events event
  where event.event_name = 'button_click'
    and nullif(event.properties ->> 'control', '') in (
      'parent-task-add',
      'parent-daily-adventure-add',
      'parent-general-adventure-add'
    )
),
task_created as (
  select
    count(*)::bigint as total_events,
    count(distinct task.family_id)::bigint as unique_families
  from public.tasks task
)
select 1 as step_order, 'parent_panel_view'::text as step_key, '進家長面板'::text as step_label, panel_view.unique_users, panel_view.unique_families, panel_view.total_events from panel_view
union all
select 2, 'parent_tasks_view', '進任務頁', tasks_view.unique_users, tasks_view.unique_families, tasks_view.total_events from tasks_view
union all
select 3, 'parent_task_form_open', '按新增開表單', form_open.unique_users, form_open.unique_families, form_open.total_events from form_open
union all
select 4, 'parent_task_created', '成功發佈任務', task_created.unique_families, task_created.unique_families, task_created.total_events from task_created
order by step_order;

revoke all on private.analytics_parent_task_funnel from public, anon, authenticated;

create or replace function public.get_admin_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  payload jsonb;
begin
  perform private.assert_habithero_admin();

  select jsonb_build_object(
    'summary', coalesce((
      select jsonb_agg(to_jsonb(summary_row) order by summary_row.last_known_activity_at desc nulls last)
      from private.analytics_child_summary summary_row
    ), '[]'::jsonb),
    'funnel', coalesce((
      select jsonb_agg(to_jsonb(funnel_row) order by funnel_row.completed_tasks desc, funnel_row.child_name)
      from private.analytics_task_funnel funnel_row
    ), '[]'::jsonb),
    'dailyActivity', coalesce((
      select jsonb_agg(to_jsonb(daily_row) order by daily_row.activity_date)
      from private.analytics_daily_activity daily_row
    ), '[]'::jsonb),
    'retention', coalesce((
      select jsonb_agg(to_jsonb(retention_row) order by retention_row.cohort_date, retention_row.days_since_first_open)
      from private.analytics_retention retention_row
    ), '[]'::jsonb),
    'tutorial', coalesce((
      select jsonb_agg(to_jsonb(tutorial_row) order by tutorial_row.step_number)
      from private.analytics_tutorial_funnel tutorial_row
    ), '[]'::jsonb),
    'sceneDwell', coalesce((
      select jsonb_agg(to_jsonb(scene_row) order by scene_row.dwell_seconds desc, scene_row.scene_name)
      from private.analytics_scene_funnel scene_row
    ), '[]'::jsonb),
    'parentTaskFunnel', coalesce((
      select jsonb_agg(to_jsonb(parent_row) order by parent_row.step_order)
      from private.analytics_parent_task_funnel parent_row
    ), '[]'::jsonb)
  ) into payload;

  return payload;
end;
$$;

revoke all on function public.get_admin_analytics() from public, anon;
grant execute on function public.get_admin_analytics() to authenticated;

revoke all on private.analytics_child_summary from public, anon, authenticated;
revoke all on private.analytics_task_funnel from public, anon, authenticated;
revoke all on private.analytics_daily_activity from public, anon, authenticated;
revoke all on private.analytics_retention from public, anon, authenticated;
revoke all on private.analytics_tutorial_funnel from public, anon, authenticated;
revoke all on private.analytics_scene_funnel from public, anon, authenticated;
