-- HabitHero product analytics.
--
-- Domain views summarize data that already exists. The event table adds the
-- small amount of client instrumentation needed for sessions, screens,
-- tutorial drop-off, scene dwell time, DAU, and D7 retention. Raw events are
-- never directly readable from the public Data API; clients can only submit
-- their own authenticated events through the guarded RPC below. The product
-- dashboard reads aggregated data through the admin-only RPC.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  child_profile_id uuid references public.child_profiles(id) on delete set null,
  session_id uuid not null,
  event_name text not null check (char_length(trim(event_name)) between 1 and 80),
  screen_name text check (screen_name is null or char_length(trim(screen_name)) between 1 and 80),
  properties jsonb not null default '{}'::jsonb,
  platform text not null default 'web' check (platform in ('web', 'ios', 'android', 'unknown')),
  app_version text check (app_version is null or char_length(trim(app_version)) between 1 and 40),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (jsonb_typeof(properties) = 'object'),
  check (char_length(properties::text) <= 4096)
);

create index if not exists analytics_events_occurred_at_idx
  on public.analytics_events (occurred_at desc);
create index if not exists analytics_events_profile_occurred_at_idx
  on public.analytics_events (profile_id, occurred_at desc);
create index if not exists analytics_events_child_occurred_at_idx
  on public.analytics_events (child_profile_id, occurred_at desc);
create index if not exists analytics_events_event_name_occurred_at_idx
  on public.analytics_events (event_name, occurred_at desc);

alter table public.analytics_events enable row level security;
revoke all on table public.analytics_events from public, anon, authenticated;

create or replace function private.analytics_event_name_allowed(target_event_name text)
returns boolean
language sql
immutable
security definer
set search_path = pg_catalog, public, private
as $$
  select target_event_name = any (array[
    'app_open',
    'session_start',
    'session_end',
    'screen_view',
    'button_click',
    'tutorial_step',
    'world_enter',
    'world_exit',
    'scene_enter',
    'scene_exit',
    'scene_dwell'
  ]::text[]);
$$;

revoke all on function private.analytics_event_name_allowed(text) from public, anon, authenticated;

create or replace function private.is_habithero_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select (select auth.uid()) is not null
     and lower(coalesce((select auth.jwt() ->> 'email'), '')) = 'f1272837411@gmail.com';
$$;

revoke all on function private.is_habithero_admin() from public, anon, authenticated;

create or replace function private.assert_habithero_admin()
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not private.is_habithero_admin() then
    raise exception using errcode = '42501', message = 'analytics_admin_required';
  end if;
end;
$$;

revoke all on function private.assert_habithero_admin() from public, anon, authenticated;

create or replace function public.record_analytics_events(event_batch jsonb)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  caller_profile_id uuid := (select auth.uid());
  caller_family_id uuid;
  event_row jsonb;
  event_name text;
  session_id uuid;
  child_profile_id uuid;
  event_properties jsonb;
  event_platform text;
  event_app_version text;
  event_occurred_at timestamptz;
  inserted_count integer := 0;
begin
  if caller_profile_id is null then
    raise exception using errcode = '42501', message = 'analytics_auth_required';
  end if;

  if jsonb_typeof(event_batch) <> 'array'
     or jsonb_array_length(event_batch) < 1
     or jsonb_array_length(event_batch) > 50 then
    raise exception using errcode = '22023', message = 'analytics_batch_invalid';
  end if;

  select member.family_id
    into caller_family_id
    from public.family_members member
   where member.profile_id = caller_profile_id
   order by member.created_at
   limit 1;

  if caller_family_id is null then
    raise exception using errcode = '42501', message = 'analytics_family_required';
  end if;

  for event_row in select value from jsonb_array_elements(event_batch)
  loop
    event_name := nullif(trim(event_row ->> 'event_name'), '');
    if event_name is null or not private.analytics_event_name_allowed(event_name) then
      raise exception using errcode = '22023', message = 'analytics_event_invalid';
    end if;

    session_id := nullif(trim(event_row ->> 'session_id'), '')::uuid;
    if session_id is null then
      raise exception using errcode = '22023', message = 'analytics_session_invalid';
    end if;

    child_profile_id := nullif(trim(event_row ->> 'child_profile_id'), '')::uuid;
    if child_profile_id is not null and not exists (
      select 1
        from public.child_profiles child
       where child.id = child_profile_id
         and child.family_id = caller_family_id
    ) then
      raise exception using errcode = '42501', message = 'analytics_child_invalid';
    end if;

    event_properties := coalesce(event_row -> 'properties', '{}'::jsonb);
    if jsonb_typeof(event_properties) <> 'object'
       or char_length(event_properties::text) > 4096 then
      raise exception using errcode = '22023', message = 'analytics_properties_invalid';
    end if;

    event_platform := coalesce(nullif(trim(event_row ->> 'platform'), ''), 'web');
    if event_platform not in ('web', 'ios', 'android', 'unknown') then
      raise exception using errcode = '22023', message = 'analytics_platform_invalid';
    end if;

    event_app_version := nullif(trim(event_row ->> 'app_version'), '');
    if event_app_version is not null and char_length(event_app_version) > 40 then
      event_app_version := left(event_app_version, 40);
    end if;

    event_occurred_at := coalesce(nullif(trim(event_row ->> 'occurred_at'), '')::timestamptz, now());
    if event_occurred_at < now() - interval '30 days'
       or event_occurred_at > now() + interval '10 minutes' then
      event_occurred_at := now();
    end if;

    insert into public.analytics_events (
      profile_id,
      family_id,
      child_profile_id,
      session_id,
      event_name,
      screen_name,
      properties,
      platform,
      app_version,
      occurred_at
    ) values (
      caller_profile_id,
      caller_family_id,
      child_profile_id,
      session_id,
      event_name,
      nullif(left(trim(event_row ->> 'screen_name'), 80), ''),
      event_properties,
      event_platform,
      event_app_version,
      event_occurred_at
    );

    inserted_count := inserted_count + 1;
  end loop;

  return inserted_count;
end;
$$;

revoke all on function public.record_analytics_events(jsonb) from public, anon;
grant execute on function public.record_analytics_events(jsonb) to authenticated;

create or replace view private.analytics_child_summary as
with task_stats as (
  select
    task.child_profile_id,
    count(*)::bigint as task_rows_created,
    count(*) filter (where task.status in ('todo', 'pending', 'revision_requested', 'completed'))::bigint as planned_tasks,
    count(*) filter (where task.submitted_at is not null)::bigint as submitted_tasks,
    count(*) filter (where task.status = 'completed')::bigint as completed_tasks,
    count(*) filter (where task.status = 'pending')::bigint as pending_tasks,
    count(*) filter (where task.status = 'todo')::bigint as todo_tasks,
    count(*) filter (where task.status = 'revision_requested')::bigint as revision_requested_tasks,
    count(*) filter (where task.status = 'cancelled')::bigint as cancelled_tasks,
    max(coalesce(task.completed_at, task.submitted_at, task.reviewed_at, task.updated_at, task.created_at)) as last_task_activity_at
  from public.tasks task
  group by task.child_profile_id
),
timer_stats as (
  select
    timer.child_profile_id,
    count(*)::bigint as timer_sessions,
    coalesce(sum(timer.accumulated_seconds), 0)::bigint as timer_seconds,
    max(coalesce(timer.completed_at, timer.paused_at, timer.updated_at, timer.created_at)) as last_timer_activity_at
  from public.adventure_timer_sessions timer
  group by timer.child_profile_id
),
point_stats as (
  select
    ledger.child_profile_id,
    coalesce(sum(ledger.points_delta) filter (where ledger.entry_type = 'task_approved' and ledger.points_delta > 0), 0)::bigint as approved_points,
    coalesce(sum(abs(ledger.points_delta)) filter (where ledger.entry_type = 'reward_redemption'), 0)::bigint as redeemed_points,
    count(*) filter (where ledger.entry_type = 'task_approved')::bigint as point_award_entries,
    count(*) filter (where ledger.entry_type = 'reward_redemption')::bigint as point_redemption_entries,
    max(ledger.created_at) as last_point_activity_at
  from public.point_ledger ledger
  group by ledger.child_profile_id
),
redemption_stats as (
  select
    redemption.child_profile_id,
    count(*)::bigint as reward_redemptions,
    count(*) filter (where redemption.status = 'fulfilled')::bigint as fulfilled_redemptions,
    max(redemption.created_at) as last_redemption_at
  from public.reward_redemptions redemption
  group by redemption.child_profile_id
),
purchase_stats as (
  select
    purchase.child_profile_id,
    count(*)::bigint as game_purchases,
    coalesce(sum(purchase.total_price), 0)::bigint as game_scrolls_spent,
    max(purchase.created_at) as last_purchase_at
  from public.game_item_purchases purchase
  group by purchase.child_profile_id
),
world_stats as (
  select
    child.id as child_profile_id,
    count(distinct unlock.scene_id)::bigint as scenes_unlocked,
    count(distinct dialogue.npc_id)::bigint as npcs_talked_to,
    max(unlock.unlocked_at) as last_scene_unlock_at,
    max(dialogue.last_talked_at) as last_npc_talk_at
  from public.child_profiles child
  left join public.child_world_scene_unlocks unlock on unlock.child_profile_id = child.id
  left join public.child_world_npc_dialogue_progress dialogue on dialogue.child_profile_id = child.id
  group by child.id
),
friend_stats as (
  select
    child.id as child_profile_id,
    count(friendship.*) filter (where friendship.status = 'accepted')::bigint as accepted_friendships
  from public.child_profiles child
  left join public.child_friendships friendship
    on friendship.child_profile_id = child.id
    or friendship.friend_child_profile_id = child.id
  group by child.id
),
chat_stats as (
  select
    child.id as child_profile_id,
    count(message.*) filter (where message.status = 'visible' and message.sender_child_profile_id = child.id)::bigint as chat_messages_sent,
    max(message.created_at) filter (where message.status = 'visible' and message.sender_child_profile_id = child.id) as last_chat_at
  from public.child_profiles child
  left join public.friend_world_messages message on message.sender_child_profile_id = child.id
  group by child.id
),
event_stats as (
  select
    event.child_profile_id,
    count(*) filter (where event.event_name = 'session_start')::bigint as analytics_sessions,
    coalesce(sum(
      case
        when event.event_name = 'session_end'
          and event.properties ->> 'duration_seconds' ~ '^[0-9]+(\\.[0-9]+)?$'
          then least((event.properties ->> 'duration_seconds')::numeric, 86400)
        else 0
      end
    ), 0)::bigint as analytics_session_seconds,
    count(*) filter (where event.event_name = 'screen_view')::bigint as screen_views,
    count(*) filter (where event.event_name = 'button_click')::bigint as button_clicks,
    count(*) filter (where event.event_name = 'tutorial_step')::bigint as tutorial_steps_seen,
    count(*) filter (where event.event_name = 'scene_enter')::bigint as scenes_entered,
    coalesce(sum(
      case
        when event.event_name = 'scene_dwell'
          and event.properties ->> 'duration_seconds' ~ '^[0-9]+(\\.[0-9]+)?$'
          then least((event.properties ->> 'duration_seconds')::numeric, 86400)
        else 0
      end
    ), 0)::bigint as scene_dwell_seconds,
    max(event.occurred_at) as last_analytics_activity_at
  from public.analytics_events event
  where event.child_profile_id is not null
  group by event.child_profile_id
),
last_screen_stats as (
  select distinct on (event.child_profile_id)
    event.child_profile_id,
    event.screen_name as last_screen_name
  from public.analytics_events event
  where event.child_profile_id is not null
    and event.event_name = 'screen_view'
  order by event.child_profile_id, event.occurred_at desc, event.id desc
),
domain_activity as (
  select child.id as child_profile_id, child.joined_at as activity_at
  from public.child_profiles child
  union all
  select task.child_profile_id, task.created_at from public.tasks task
  union all
  select task.child_profile_id, task.submitted_at from public.tasks task where task.submitted_at is not null
  union all
  select task.child_profile_id, task.completed_at from public.tasks task where task.completed_at is not null
  union all
  select task.child_profile_id, task.reviewed_at from public.tasks task where task.reviewed_at is not null
  union all
  select timer.child_profile_id, timer.created_at from public.adventure_timer_sessions timer
  union all
  select timer.child_profile_id, timer.updated_at from public.adventure_timer_sessions timer
  union all
  select ledger.child_profile_id, ledger.created_at from public.point_ledger ledger
  union all
  select redemption.child_profile_id, redemption.created_at from public.reward_redemptions redemption
  union all
  select purchase.child_profile_id, purchase.created_at from public.game_item_purchases purchase
  union all
  select unlock.child_profile_id, unlock.unlocked_at from public.child_world_scene_unlocks unlock
  union all
  select dialogue.child_profile_id, dialogue.last_talked_at from public.child_world_npc_dialogue_progress dialogue
  union all
  select request.requester_child_profile_id, request.created_at from public.child_friend_requests request
  union all
  select message.sender_child_profile_id, message.created_at
  from public.friend_world_messages message
  where message.status = 'visible'
  union all
  select event.child_profile_id, event.occurred_at
  from public.analytics_events event
  where event.child_profile_id is not null
),
last_activity as (
  select child_profile_id, max(activity_at) as last_known_domain_activity_at
  from domain_activity
  where activity_at is not null
  group by child_profile_id
)
select
  child.family_id,
  family.name as family_name,
  child.id as child_profile_id,
  child.display_name as child_name,
  child.joined_at,
  child.created_at as child_created_at,
  child.points_balance,
  coalesce(task_stats.task_rows_created, 0) as task_rows_created,
  coalesce(task_stats.planned_tasks, 0) as planned_tasks,
  coalesce(task_stats.submitted_tasks, 0) as submitted_tasks,
  coalesce(task_stats.completed_tasks, 0) as completed_tasks,
  coalesce(task_stats.pending_tasks, 0) as pending_tasks,
  coalesce(task_stats.todo_tasks, 0) as todo_tasks,
  coalesce(task_stats.revision_requested_tasks, 0) as revision_requested_tasks,
  coalesce(task_stats.cancelled_tasks, 0) as cancelled_tasks,
  case
    when coalesce(task_stats.planned_tasks, 0) = 0 then 0
    else round(100.0 * task_stats.completed_tasks / task_stats.planned_tasks, 1)
  end as task_completion_rate,
  coalesce(timer_stats.timer_sessions, 0) as timer_sessions,
  coalesce(timer_stats.timer_seconds, 0) as timer_seconds,
  coalesce(point_stats.approved_points, 0) as approved_points,
  coalesce(point_stats.redeemed_points, 0) as redeemed_points,
  coalesce(point_stats.point_award_entries, 0) as point_award_entries,
  coalesce(point_stats.point_redemption_entries, 0) as point_redemption_entries,
  coalesce(redemption_stats.reward_redemptions, 0) as reward_redemptions,
  coalesce(redemption_stats.fulfilled_redemptions, 0) as fulfilled_redemptions,
  coalesce(purchase_stats.game_purchases, 0) as game_purchases,
  coalesce(purchase_stats.game_scrolls_spent, 0) as game_scrolls_spent,
  coalesce(world_stats.scenes_unlocked, 0) as scenes_unlocked,
  coalesce(world_stats.npcs_talked_to, 0) as npcs_talked_to,
  coalesce(friend_stats.accepted_friendships, 0) as accepted_friendships,
  coalesce(chat_stats.chat_messages_sent, 0) as chat_messages_sent,
  coalesce(event_stats.analytics_sessions, 0) as analytics_sessions,
  coalesce(event_stats.analytics_session_seconds, 0) as analytics_session_seconds,
  coalesce(event_stats.screen_views, 0) as screen_views,
  coalesce(event_stats.button_clicks, 0) as button_clicks,
  coalesce(event_stats.tutorial_steps_seen, 0) as tutorial_steps_seen,
  coalesce(event_stats.scenes_entered, 0) as scenes_entered,
  coalesce(event_stats.scene_dwell_seconds, 0) as scene_dwell_seconds,
  last_screen_stats.last_screen_name,
  greatest(last_activity.last_known_domain_activity_at, event_stats.last_analytics_activity_at) as last_known_activity_at
from public.child_profiles child
join public.families family on family.id = child.family_id
left join task_stats on task_stats.child_profile_id = child.id
left join timer_stats on timer_stats.child_profile_id = child.id
left join point_stats on point_stats.child_profile_id = child.id
left join redemption_stats on redemption_stats.child_profile_id = child.id
left join purchase_stats on purchase_stats.child_profile_id = child.id
left join world_stats on world_stats.child_profile_id = child.id
left join friend_stats on friend_stats.child_profile_id = child.id
left join chat_stats on chat_stats.child_profile_id = child.id
left join event_stats on event_stats.child_profile_id = child.id
left join last_screen_stats on last_screen_stats.child_profile_id = child.id
left join last_activity on last_activity.child_profile_id = child.id;

create or replace view private.analytics_task_funnel as
select
  task.family_id,
  family.name as family_name,
  task.child_profile_id,
  child.display_name as child_name,
  task.adventure_type,
  task.category,
  count(*) filter (where task.status in ('todo', 'pending', 'revision_requested', 'completed'))::bigint as planned_tasks,
  count(*) filter (where task.submitted_at is not null)::bigint as submitted_tasks,
  count(*) filter (where task.status = 'completed')::bigint as completed_tasks,
  count(*) filter (where task.status = 'pending')::bigint as pending_tasks,
  count(*) filter (where task.status = 'revision_requested')::bigint as revision_requested_tasks,
  count(*) filter (where task.status = 'todo')::bigint as todo_tasks,
  case
    when count(*) filter (where task.status in ('todo', 'pending', 'revision_requested', 'completed')) = 0 then 0
    else round(
      100.0
      * count(*) filter (where task.status = 'completed')
      / (count(*) filter (where task.status in ('todo', 'pending', 'revision_requested', 'completed'))),
      1
    )
  end as completion_rate
from public.tasks task
join public.families family on family.id = task.family_id
join public.child_profiles child on child.id = task.child_profile_id
group by task.family_id, family.name, task.child_profile_id, child.display_name, task.adventure_type, task.category;

create or replace view private.analytics_daily_activity as
with event_rows(child_profile_id, profile_id, event_name, occurred_at, properties) as (
  select child.id, null::uuid, 'child_joined'::text, child.joined_at, '{}'::jsonb
  from public.child_profiles child
  union all
  select task.child_profile_id, null::uuid, 'task_created', task.created_at, '{}'::jsonb from public.tasks task
  union all
  select task.child_profile_id, null::uuid, 'task_submitted', task.submitted_at, '{}'::jsonb from public.tasks task where task.submitted_at is not null
  union all
  select task.child_profile_id, null::uuid, 'task_completed', task.completed_at, '{}'::jsonb from public.tasks task where task.completed_at is not null
  union all
  select task.child_profile_id, null::uuid, 'task_reviewed', task.reviewed_at, '{}'::jsonb from public.tasks task where task.reviewed_at is not null
  union all
  select timer.child_profile_id, null::uuid, 'timer_started', timer.started_at, '{}'::jsonb from public.adventure_timer_sessions timer
  union all
  select timer.child_profile_id, null::uuid, 'timer_completed', timer.completed_at, '{}'::jsonb from public.adventure_timer_sessions timer where timer.completed_at is not null
  union all
  select ledger.child_profile_id, null::uuid, 'points_awarded', ledger.created_at, '{}'::jsonb
  from public.point_ledger ledger
  where ledger.entry_type = 'task_approved' and ledger.points_delta > 0
  union all
  select redemption.child_profile_id, null::uuid, 'reward_redeemed', redemption.created_at, '{}'::jsonb from public.reward_redemptions redemption
  union all
  select purchase.child_profile_id, null::uuid, 'game_purchase', purchase.created_at, '{}'::jsonb from public.game_item_purchases purchase
  union all
  select unlock.child_profile_id, null::uuid, 'scene_unlocked', unlock.unlocked_at, '{}'::jsonb from public.child_world_scene_unlocks unlock
  union all
  select dialogue.child_profile_id, null::uuid, 'npc_talked', dialogue.last_talked_at, '{}'::jsonb from public.child_world_npc_dialogue_progress dialogue
  union all
  select request.requester_child_profile_id, null::uuid, 'friend_request_sent', request.created_at, '{}'::jsonb from public.child_friend_requests request
  union all
  select message.sender_child_profile_id, null::uuid, 'chat_message_sent', message.created_at, '{}'::jsonb
  from public.friend_world_messages message
  where message.status = 'visible'
  union all
  select adventure.creator_child_profile_id, null::uuid, 'coop_adventure_created', adventure.created_at, '{}'::jsonb
  from public.coop_adventures adventure
  union all
  select participant.child_profile_id, null::uuid, 'coop_completion_submitted', completion.submitted_at, '{}'::jsonb
  from public.coop_adventure_completions completion
  join public.coop_adventure_participants participant on participant.id = completion.participant_id
  where completion.submitted_at is not null
  union all
  select event.child_profile_id, event.profile_id, event.event_name, event.occurred_at, event.properties
  from public.analytics_events event
),
normalized_rows as (
  select
    event_rows.*,
    case
      when event_rows.event_name in ('session_end', 'scene_dwell')
        and event_rows.properties ->> 'duration_seconds' ~ '^[0-9]+(\\.[0-9]+)?$'
        then least((event_rows.properties ->> 'duration_seconds')::numeric, 86400)
      else 0
    end as duration_seconds
  from event_rows
)
select
  (normalized_rows.occurred_at at time zone 'Asia/Taipei')::date as activity_date,
  count(*)::bigint as total_domain_events,
  count(*) filter (where normalized_rows.profile_id is not null)::bigint as total_analytics_events,
  count(distinct normalized_rows.profile_id)::bigint as active_users,
  count(distinct normalized_rows.child_profile_id)::bigint as domain_active_children,
  count(*) filter (where normalized_rows.event_name = 'app_open')::bigint as app_opens,
  count(*) filter (where normalized_rows.event_name = 'session_start')::bigint as sessions_started,
  count(*) filter (where normalized_rows.event_name = 'session_end')::bigint as sessions_ended,
  coalesce(sum(normalized_rows.duration_seconds) filter (where normalized_rows.event_name = 'session_end'), 0)::bigint as session_seconds,
  coalesce(round(avg(normalized_rows.duration_seconds) filter (where normalized_rows.event_name = 'session_end' and normalized_rows.duration_seconds > 0), 1), 0)::numeric as avg_session_seconds,
  count(*) filter (where normalized_rows.event_name = 'screen_view')::bigint as screen_views,
  count(*) filter (where normalized_rows.event_name = 'button_click')::bigint as button_clicks,
  count(*) filter (where normalized_rows.event_name = 'tutorial_step')::bigint as tutorial_steps,
  count(*) filter (where normalized_rows.event_name = 'world_enter')::bigint as world_enters,
  count(*) filter (where normalized_rows.event_name = 'scene_enter')::bigint as scene_enters,
  count(*) filter (where normalized_rows.event_name = 'scene_exit')::bigint as scene_exits,
  coalesce(sum(normalized_rows.duration_seconds) filter (where normalized_rows.event_name = 'scene_dwell'), 0)::bigint as scene_dwell_seconds,
  count(*) filter (where normalized_rows.event_name = 'task_created')::bigint as tasks_created,
  count(*) filter (where normalized_rows.event_name = 'task_submitted')::bigint as tasks_submitted,
  count(*) filter (where normalized_rows.event_name = 'task_completed')::bigint as tasks_completed,
  count(*) filter (where normalized_rows.event_name = 'task_reviewed')::bigint as tasks_reviewed,
  count(*) filter (where normalized_rows.event_name = 'timer_started')::bigint as timers_started,
  count(*) filter (where normalized_rows.event_name = 'timer_completed')::bigint as timers_completed,
  count(*) filter (where normalized_rows.event_name = 'points_awarded')::bigint as points_awarded,
  count(*) filter (where normalized_rows.event_name = 'reward_redeemed')::bigint as rewards_redeemed,
  count(*) filter (where normalized_rows.event_name = 'game_purchase')::bigint as game_purchases,
  count(*) filter (where normalized_rows.event_name = 'scene_unlocked')::bigint as scenes_unlocked,
  count(*) filter (where normalized_rows.event_name = 'npc_talked')::bigint as npc_talks,
  count(*) filter (where normalized_rows.event_name = 'friend_request_sent')::bigint as friend_requests_sent,
  count(*) filter (where normalized_rows.event_name = 'chat_message_sent')::bigint as chat_messages_sent,
  count(*) filter (where normalized_rows.event_name = 'coop_adventure_created')::bigint as coop_adventures_created,
  count(*) filter (where normalized_rows.event_name = 'coop_completion_submitted')::bigint as coop_completions_submitted
from normalized_rows
where normalized_rows.occurred_at is not null
group by (normalized_rows.occurred_at at time zone 'Asia/Taipei')::date;

create or replace view private.analytics_retention as
with first_open as (
  select
    event.profile_id,
    min((event.occurred_at at time zone 'Asia/Taipei')::date) as cohort_date
  from public.analytics_events event
  where event.event_name = 'app_open'
  group by event.profile_id
),
active_days as (
  select distinct
    event.profile_id,
    (event.occurred_at at time zone 'Asia/Taipei')::date as activity_date
  from public.analytics_events event
  where event.event_name in ('app_open', 'session_start')
),
day_offsets as (
  select generate_series(0, 30)::integer as days_since_first_open
)
select
  first_open.cohort_date,
  day_offsets.days_since_first_open,
  count(distinct first_open.profile_id)::bigint as cohort_users,
  count(distinct active_days.profile_id)::bigint as retained_users,
  case
    when count(distinct first_open.profile_id) = 0 then 0
    else round(
      100.0 * count(distinct active_days.profile_id) / count(distinct first_open.profile_id),
      1
    )
  end as retention_rate
from first_open
cross join day_offsets
left join active_days
  on active_days.profile_id = first_open.profile_id
 and active_days.activity_date = first_open.cohort_date + day_offsets.days_since_first_open
group by first_open.cohort_date, day_offsets.days_since_first_open;

create or replace view private.analytics_tutorial_funnel as
select
  nullif(event.properties ->> 'step', '')::integer as step_number,
  count(*)::bigint as step_events,
  count(distinct event.profile_id)::bigint as unique_users,
  count(*) filter (where event.properties ->> 'action' = 'skip')::bigint as skipped_events,
  count(*) filter (where event.properties ->> 'action' = 'complete')::bigint as completed_events
from public.analytics_events event
where event.event_name = 'tutorial_step'
  and event.properties ->> 'step' ~ '^[1-9][0-9]*$'
group by nullif(event.properties ->> 'step', '')::integer;

create or replace view private.analytics_scene_funnel as
select
  coalesce(nullif(event.properties ->> 'scene', ''), '未命名場景') as scene_name,
  count(*) filter (where event.event_name = 'scene_enter')::bigint as scene_enters,
  count(*) filter (where event.event_name = 'scene_exit')::bigint as scene_exits,
  count(distinct event.profile_id)::bigint as unique_users,
  coalesce(sum(
    case
      when event.event_name = 'scene_dwell'
        and event.properties ->> 'duration_seconds' ~ '^[0-9]+(\\.[0-9]+)?$'
        then least((event.properties ->> 'duration_seconds')::numeric, 86400)
      else 0
    end
  ), 0)::bigint as dwell_seconds,
  coalesce(round(avg(
    case
      when event.event_name = 'scene_dwell'
        and event.properties ->> 'duration_seconds' ~ '^[0-9]+(\\.[0-9]+)?$'
        then least((event.properties ->> 'duration_seconds')::numeric, 86400)
      else null
    end
  ), 1), 0)::numeric as avg_dwell_seconds
from public.analytics_events event
where event.event_name in ('scene_enter', 'scene_exit', 'scene_dwell')
group by coalesce(nullif(event.properties ->> 'scene', ''), '未命名場景');

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
