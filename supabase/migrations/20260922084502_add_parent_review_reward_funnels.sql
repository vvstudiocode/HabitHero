-- Parent review & reward funnels: where parents drop off during review and reward setup.
--
-- Both reuse the existing analytics contract (no new event_name):
--   screen_view with screen = 'parent:review' / 'parent:rewards'
--   button_click with control IN (parent-review-open, parent-review-approve, parent-review-request,
--      parent-reward-add, parent-reward-save, parent-wishlist-approve)
--   Domain events from public.tasks (task_reviewed, task_completed) and public.rewards (created)

-- ============================================================
-- PARENT REVIEW FUNNEL
-- ============================================================
-- Steps:
--   1. screen_view with screen = 'parent:review' (already emitted)
--   2. button_click with control = 'parent-review-open' (open a task to review)
--   3. button_click with control IN ('parent-review-approve', 'parent-review-request') (submit decision)
--   4. domain task_reviewed / task_completed from public.tasks (final success signal)
--
-- Step 4 counts distinct families with at least one reviewed/completed task.

create or replace view private.analytics_parent_review_funnel as
with review_panel as (
  select
    count(*)::bigint as total_events,
    count(distinct event.profile_id)::bigint as unique_users,
    count(distinct event.family_id)::bigint as unique_families
  from public.analytics_events event
  where event.event_name = 'screen_view'
    and (
      nullif(event.properties ->> 'screen', '') = 'parent:review'
      or event.screen_name = 'parent:review'
    )
),
review_open as (
  select
    count(*)::bigint as total_events,
    count(distinct event.profile_id)::bigint as unique_users,
    count(distinct event.family_id)::bigint as unique_families
  from public.analytics_events event
  where event.event_name = 'button_click'
    and nullif(event.properties ->> 'control', '') = 'parent-review-open'
),
review_submit as (
  select
    count(*)::bigint as total_events,
    count(distinct event.profile_id)::bigint as unique_users,
    count(distinct event.family_id)::bigint as unique_families
  from public.analytics_events event
  where event.event_name = 'button_click'
    and nullif(event.properties ->> 'control', '') in ('parent-review-approve', 'parent-review-request')
),
task_reviewed as (
  select
    count(*)::bigint as total_events,
    count(distinct task.family_id)::bigint as unique_families
  from public.tasks task
  where task.reviewed_at is not null
)
select 1 as step_order, 'parent_review_panel'::text as step_key, '進審核頁'::text as step_label, review_panel.unique_users, review_panel.unique_families, review_panel.total_events from review_panel
union all
select 2, 'parent_review_open', '開啟審核表單', review_open.unique_users, review_open.unique_families, review_open.total_events from review_open
union all
select 3, 'parent_review_submit', '送出審核決定', review_submit.unique_users, review_submit.unique_families, review_submit.total_events from review_submit
union all
select 4, 'parent_task_reviewed', '完成審核', task_reviewed.unique_families, task_reviewed.unique_families, task_reviewed.total_events from task_reviewed
order by step_order;

revoke all on private.analytics_parent_review_funnel from public, anon, authenticated;

-- ============================================================
-- PARENT REWARD FUNNEL
-- ============================================================
-- Steps:
--   1. screen_view with screen = 'parent:rewards' (already emitted)
--   2. button_click with control = 'parent-reward-add' (open new reward form)
--   3. button_click with control = 'parent-reward-save' (save reward)
--   4. domain reward_created from public.rewards (final success signal)
--   5. (bonus) button_click with control = 'parent-wishlist-approve' (approve wishlist)
--   6. (bonus) domain wishlist_approved from point_ledger (final success signal)
--
-- Steps 4 & 6 count distinct families.

create or replace view private.analytics_parent_reward_funnel as
with rewards_panel as (
  select
    count(*)::bigint as total_events,
    count(distinct event.profile_id)::bigint as unique_users,
    count(distinct event.family_id)::bigint as unique_families
  from public.analytics_events event
  where event.event_name = 'screen_view'
    and (
      nullif(event.properties ->> 'screen', '') = 'parent:rewards'
      or event.screen_name = 'parent:rewards'
    )
),
reward_add as (
  select
    count(*)::bigint as total_events,
    count(distinct event.profile_id)::bigint as unique_users,
    count(distinct event.family_id)::bigint as unique_families
  from public.analytics_events event
  where event.event_name = 'button_click'
    and nullif(event.properties ->> 'control', '') = 'parent-reward-add'
),
reward_save as (
  select
    count(*)::bigint as total_events,
    count(distinct event.profile_id)::bigint as unique_users,
    count(distinct event.family_id)::bigint as unique_families
  from public.analytics_events event
  where event.event_name = 'button_click'
    and nullif(event.properties ->> 'control', '') = 'parent-reward-save'
),
reward_created as (
  select
    count(*)::bigint as total_events,
    count(distinct reward.family_id)::bigint as unique_families
  from public.rewards reward
),
wishlist_approve_click as (
  select
    count(*)::bigint as total_events,
    count(distinct event.profile_id)::bigint as unique_users,
    count(distinct event.family_id)::bigint as unique_families
  from public.analytics_events event
  where event.event_name = 'button_click'
    and nullif(event.properties ->> 'control', '') = 'parent-wishlist-approve'
),
wishlist_approved as (
  select
    count(*)::bigint as total_events,
    count(distinct ledger.family_id)::bigint as unique_families
  from public.point_ledger ledger
  join public.reward_redemptions redemption on redemption.id = ledger.reference_id
  where ledger.entry_type = 'reward_redemption'
    and redemption.status = 'fulfilled'
)
select 1 as step_order, 'parent_rewards_panel'::text as step_key, '進獎勵頁'::text as step_label, rewards_panel.unique_users, rewards_panel.unique_families, rewards_panel.total_events from rewards_panel
union all
select 2, 'parent_reward_add', '開啟新增獎勵', reward_add.unique_users, reward_add.unique_families, reward_add.total_events from reward_add
union all
select 3, 'parent_reward_save', '儲存獎勵', reward_save.unique_users, reward_save.unique_families, reward_save.total_events from reward_save
union all
select 4, 'parent_reward_created', '成功建立獎勵', reward_created.unique_families, reward_created.unique_families, reward_created.total_events from reward_created
union all
select 5, 'parent_wishlist_approve_click', '點選許願上架', wishlist_approve_click.unique_users, wishlist_approve_click.unique_families, wishlist_approve_click.total_events from wishlist_approve_click
union all
select 6, 'parent_wishlist_approved', '許願完成兌現', wishlist_approved.unique_families, wishlist_approved.unique_families, wishlist_approved.total_events from wishlist_approved
order by step_order;

revoke all on private.analytics_parent_reward_funnel from public, anon, authenticated;

-- ============================================================
-- UPDATE get_admin_analytics() to include both new funnels
-- ============================================================
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
    ), '[]'::jsonb),
    'parentReviewFunnel', coalesce((
      select jsonb_agg(to_jsonb(parent_row) order by parent_row.step_order)
      from private.analytics_parent_review_funnel parent_row
    ), '[]'::jsonb),
    'parentRewardFunnel', coalesce((
      select jsonb_agg(to_jsonb(parent_row) order by parent_row.step_order)
      from private.analytics_parent_reward_funnel parent_row
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
revoke all on private.analytics_parent_task_funnel from public, anon, authenticated;
revoke all on private.analytics_parent_review_funnel from public, anon, authenticated;
revoke all on private.analytics_parent_reward_funnel from public, anon, authenticated;