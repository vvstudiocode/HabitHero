-- HabitHero analytics contract correction.
--
-- The initial analytics migration is already deployed and immutable. This
-- migration is additive: it restores the baseline private-schema usage grant,
-- hardens the analytics RPC, and replaces analytics-only views/functions.

-- The core schema migration grants this usage because authenticated RLS
-- policies call private family helpers. The analytics migration accidentally
-- revoked it while making its own views private.
grant usage on schema private to authenticated;

-- Stable client-generated identity for retry-safe event ingestion. Existing
-- rows use their immutable row id so this change does not rewrite analytics
-- history semantically.
alter table public.analytics_events
  add column if not exists event_id uuid;

update public.analytics_events
   set event_id = id
 where event_id is null;

alter table public.analytics_events
  alter column event_id set default extensions.gen_random_uuid(),
  alter column event_id set not null;

create unique index if not exists analytics_events_profile_event_id_key
  on public.analytics_events (profile_id, event_id);

create index if not exists analytics_events_session_idx
  on public.analytics_events (profile_id, session_id, occurred_at desc);

create index if not exists analytics_events_profile_created_at_idx
  on public.analytics_events (profile_id, created_at desc);

create or replace function private.analytics_event_name_allowed(target_event_name text)
returns boolean
language sql
immutable
security definer
set search_path = pg_catalog
as $$
  select target_event_name = any (array[
    'app_open',
    'session_start',
    'session_checkpoint',
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

-- Only the event-specific scalar fields emitted by the tracker are accepted.
-- Numeric values are bounded before any cast, so malicious JSON cannot make a
-- dashboard view fail with an integer/numeric overflow.
create or replace function private.analytics_properties_valid(
  target_event_name text,
  target_properties jsonb
)
returns boolean
language plpgsql
immutable
security definer
set search_path = pg_catalog
as $$
declare
  allowed_keys text[];
  property_key text;
  property_value jsonb;
  raw_value text;
  step_value integer;
  duration_value numeric;
begin
  if target_properties is null
     or jsonb_typeof(target_properties) is distinct from 'object'
     or char_length(target_properties::text) > 4096 then
    return false;
  end if;

  case target_event_name
    when 'app_open', 'session_start' then
      allowed_keys := array[]::text[];
    when 'session_checkpoint', 'session_end' then
      allowed_keys := array['duration_seconds'];
    when 'screen_view' then
      allowed_keys := array['screen'];
    when 'button_click' then
      allowed_keys := array['control'];
    when 'tutorial_step' then
      allowed_keys := array['step', 'action'];
    when 'world_enter' then
      allowed_keys := array['location', 'scene', 'target'];
    when 'world_exit' then
      allowed_keys := array['location', 'target'];
    when 'scene_enter' then
      allowed_keys := array['scene', 'target'];
    when 'scene_exit' then
      allowed_keys := array['scene', 'target'];
    when 'scene_dwell' then
      allowed_keys := array['scene', 'location', 'target', 'duration_seconds'];
    else
      return false;
  end case;

  for property_key, property_value in
    select key, value from jsonb_each(target_properties)
  loop
    if not (property_key = any (allowed_keys)) then
      return false;
    end if;

    if jsonb_typeof(property_value) not in ('string', 'number', 'boolean') then
      return false;
    end if;

    if property_key in ('screen', 'control', 'location', 'scene', 'target') then
      if jsonb_typeof(property_value) <> 'string' then
        return false;
      end if;
      raw_value := btrim(property_value #>> '{}');
      if raw_value = '' or char_length(raw_value) > 80 then
        return false;
      end if;
    elsif property_key = 'action' then
      if jsonb_typeof(property_value) <> 'string'
         or property_value #>> '{}' not in ('view', 'next', 'back', 'skip', 'complete', 'abandon') then
        return false;
      end if;
    elsif property_key = 'step' then
      if jsonb_typeof(property_value) <> 'number' then
        return false;
      end if;
      raw_value := property_value #>> '{}';
      if raw_value !~ '^[1-9][0-9]{0,2}$' then
        return false;
      end if;
      step_value := raw_value::integer;
      if step_value < 1 or step_value > 100 then
        return false;
      end if;
    elsif property_key = 'duration_seconds' then
      if jsonb_typeof(property_value) <> 'number' then
        return false;
      end if;
      raw_value := property_value #>> '{}';
      if raw_value !~ '^(0|[0-9]{1,5})([.][0-9]{1,3})?$' then
        return false;
      end if;
      duration_value := raw_value::numeric;
      if duration_value < 0 or duration_value > 86400 then
        return false;
      end if;
    end if;
  end loop;

  if target_event_name in ('session_checkpoint', 'session_end', 'scene_dwell')
     and not (target_properties ? 'duration_seconds') then
    return false;
  end if;
  if target_event_name = 'tutorial_step'
     and (not (target_properties ? 'step') or not (target_properties ? 'action')) then
    return false;
  end if;
  if target_event_name = 'screen_view'
     and not (target_properties ? 'screen') then
    return false;
  end if;
  if target_event_name = 'button_click'
     and not (target_properties ? 'control') then
    return false;
  end if;
  if target_event_name in ('world_enter', 'world_exit')
     and not (target_properties ? 'location') then
    return false;
  end if;
  if target_event_name in ('scene_enter', 'scene_exit', 'scene_dwell')
     and not (target_properties ? 'scene') then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function private.analytics_properties_valid(text, jsonb) from public, anon, authenticated;

-- Safe readers used by views. The decimal guard uses a character class so it
-- cannot regress through SQL string escaping.
create or replace function private.analytics_duration_seconds(target_properties jsonb)
returns numeric
language plpgsql
immutable
security definer
set search_path = pg_catalog
as $$
declare
  raw_value text;
begin
  if target_properties is null
     or jsonb_typeof(target_properties) is distinct from 'object'
     or jsonb_typeof(target_properties -> 'duration_seconds') is distinct from 'number' then
    return null;
  end if;

  raw_value := target_properties ->> 'duration_seconds';
  if raw_value !~ '^(0|[0-9]{1,5})([.][0-9]{1,3})?$' then
    return null;
  end if;

  return least(raw_value::numeric, 86400::numeric);
end;
$$;

revoke all on function private.analytics_duration_seconds(jsonb) from public, anon, authenticated;

create or replace function private.analytics_tutorial_step(target_properties jsonb)
returns integer
language plpgsql
immutable
security definer
set search_path = pg_catalog
as $$
declare
  raw_value text;
  step_value integer;
begin
  if target_properties is null
     or jsonb_typeof(target_properties) is distinct from 'object'
     or jsonb_typeof(target_properties -> 'step') is distinct from 'number' then
    return null;
  end if;

  raw_value := target_properties ->> 'step';
  if raw_value !~ '^[1-9][0-9]{0,2}$' then
    return null;
  end if;

  step_value := raw_value::integer;
  if step_value < 1 or step_value > 100 then
    return null;
  end if;
  return step_value;
end;
$$;

revoke all on function private.analytics_tutorial_step(jsonb) from public, anon, authenticated;

create or replace function private.is_habithero_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
      from auth.users user_row
     where user_row.id = (select auth.uid())
       and lower(btrim(coalesce(user_row.email, ''))) = 'f1272837411@gmail.com'
       and user_row.email_confirmed_at is not null
  );
$$;

revoke all on function private.is_habithero_admin() from public, anon, authenticated;

create or replace function public.record_analytics_events(event_batch jsonb)
returns integer
language plpgsql
security definer
set search_path = extensions, pg_catalog, public, private
as $$
declare
  caller_profile_id uuid := (select auth.uid());
  caller_family_id uuid;
  caller_role text;
  event_row jsonb;
  v_event_name text;
  v_event_id uuid;
  claimed_actor_profile_id uuid;
  legacy_profile_id uuid;
  v_session_id uuid;
  v_child_profile_id uuid;
  child_family_id uuid;
  child_owner_profile_id uuid;
  event_properties jsonb;
  event_platform text;
  event_app_version text;
  event_screen_name text;
  event_occurred_at timestamptz;
  inserted_rows integer;
  inserted_count integer := 0;
begin
  if caller_profile_id is null then
    raise exception using errcode = '42501', message = 'analytics_auth_required';
  end if;

  if event_batch is null
     or jsonb_typeof(event_batch) is distinct from 'array'
     or jsonb_array_length(event_batch) < 1
     or jsonb_array_length(event_batch) > 50 then
    raise exception using errcode = '22023', message = 'analytics_batch_invalid';
  end if;

  select member.family_id, member.role
    into caller_family_id, caller_role
    from public.family_members member
   where member.profile_id = caller_profile_id
   order by member.created_at
   limit 1;

  if caller_family_id is null then
    raise exception using errcode = '42501', message = 'analytics_family_required';
  end if;

  if (
    select count(*)
      from public.analytics_events existing_event
     where existing_event.profile_id = caller_profile_id
       and existing_event.created_at >= now() - interval '24 hours'
  ) + jsonb_array_length(event_batch) > 10000 then
    raise exception using errcode = '54000', message = 'analytics_quota_exceeded';
  end if;

  for event_row in select value from jsonb_array_elements(event_batch)
  loop
    if jsonb_typeof(event_row) is distinct from 'object' then
      raise exception using errcode = '22023', message = 'analytics_event_invalid';
    end if;

    v_event_name := nullif(btrim(event_row ->> 'event_name'), '');
    if jsonb_typeof(event_row -> 'event_name') is distinct from 'string'
       or v_event_name is null
       or char_length(v_event_name) > 80
       or not private.analytics_event_name_allowed(v_event_name) then
      raise exception using errcode = '22023', message = 'analytics_event_invalid';
    end if;

    if event_row ? 'event_id' then
      if jsonb_typeof(event_row -> 'event_id') is distinct from 'string'
         or nullif(btrim(event_row ->> 'event_id'), '') is null then
        raise exception using errcode = '22023', message = 'analytics_event_id_invalid';
      end if;
      v_event_id := (btrim(event_row ->> 'event_id'))::uuid;
    else
      -- Compatibility for events queued by the deployed pre-idempotency app.
      v_event_id := gen_random_uuid();
    end if;

    if event_row ? 'actor_profile_id' then
      if jsonb_typeof(event_row -> 'actor_profile_id') is distinct from 'string'
         or nullif(btrim(event_row ->> 'actor_profile_id'), '') is null then
        raise exception using errcode = '22023', message = 'analytics_actor_invalid';
      end if;
      claimed_actor_profile_id := (btrim(event_row ->> 'actor_profile_id'))::uuid;
    else
      claimed_actor_profile_id := null;
    end if;

    if event_row ? 'profile_id' then
      if jsonb_typeof(event_row -> 'profile_id') is distinct from 'string'
         or nullif(btrim(event_row ->> 'profile_id'), '') is null then
        raise exception using errcode = '22023', message = 'analytics_actor_invalid';
      end if;
      legacy_profile_id := (btrim(event_row ->> 'profile_id'))::uuid;
    else
      legacy_profile_id := null;
    end if;

    if claimed_actor_profile_id is not null
       and legacy_profile_id is not null
       and claimed_actor_profile_id <> legacy_profile_id then
      raise exception using errcode = '42501', message = 'analytics_actor_mismatch';
    end if;
    if coalesce(claimed_actor_profile_id, legacy_profile_id) is not null
       and coalesce(claimed_actor_profile_id, legacy_profile_id) <> caller_profile_id then
      raise exception using errcode = '42501', message = 'analytics_actor_mismatch';
    end if;

    if jsonb_typeof(event_row -> 'session_id') is distinct from 'string'
       or nullif(btrim(event_row ->> 'session_id'), '') is null then
      raise exception using errcode = '22023', message = 'analytics_session_invalid';
    end if;
    v_session_id := (btrim(event_row ->> 'session_id'))::uuid;

    if event_row ? 'child_profile_id' then
      if jsonb_typeof(event_row -> 'child_profile_id') is distinct from 'string'
         or nullif(btrim(event_row ->> 'child_profile_id'), '') is null then
        raise exception using errcode = '22023', message = 'analytics_child_invalid';
      end if;
      v_child_profile_id := (btrim(event_row ->> 'child_profile_id'))::uuid;
    else
      v_child_profile_id := null;
    end if;

    if v_child_profile_id is not null then
      select child.family_id, child.profile_id
        into child_family_id, child_owner_profile_id
        from public.child_profiles child
       where child.id = v_child_profile_id;

      if child_family_id is null
         or not exists (
           select 1
             from public.family_members member
            where member.profile_id = caller_profile_id
              and member.family_id = child_family_id
         ) then
        raise exception using errcode = '42501', message = 'analytics_child_invalid';
      end if;

      select member.role
        into caller_role
        from public.family_members member
       where member.profile_id = caller_profile_id
         and member.family_id = child_family_id
       order by member.created_at
       limit 1;

      if child_owner_profile_id <> caller_profile_id and caller_role <> 'parent' then
        raise exception using errcode = '42501', message = 'analytics_child_invalid';
      end if;
      caller_family_id := child_family_id;
    end if;

    event_properties := coalesce(event_row -> 'properties', '{}'::jsonb);
    if not private.analytics_properties_valid(v_event_name, event_properties) then
      raise exception using errcode = '22023', message = 'analytics_properties_invalid';
    end if;

    if event_row ? 'platform' then
      if jsonb_typeof(event_row -> 'platform') is distinct from 'string' then
        raise exception using errcode = '22023', message = 'analytics_platform_invalid';
      end if;
      event_platform := coalesce(nullif(btrim(event_row ->> 'platform'), ''), 'web');
    else
      event_platform := 'web';
    end if;
    if event_platform not in ('web', 'ios', 'android', 'unknown') then
      raise exception using errcode = '22023', message = 'analytics_platform_invalid';
    end if;

    if event_row ? 'app_version' then
      if jsonb_typeof(event_row -> 'app_version') is distinct from 'string' then
        raise exception using errcode = '22023', message = 'analytics_app_version_invalid';
      end if;
      event_app_version := nullif(btrim(event_row ->> 'app_version'), '');
      if event_app_version is not null and char_length(event_app_version) > 40 then
        raise exception using errcode = '22023', message = 'analytics_app_version_invalid';
      end if;
    else
      event_app_version := null;
    end if;

    if event_row ? 'screen_name' then
      if jsonb_typeof(event_row -> 'screen_name') is distinct from 'string' then
        raise exception using errcode = '22023', message = 'analytics_screen_invalid';
      end if;
      event_screen_name := nullif(btrim(event_row ->> 'screen_name'), '');
      if event_screen_name is not null and char_length(event_screen_name) > 80 then
        raise exception using errcode = '22023', message = 'analytics_screen_invalid';
      end if;
    else
      event_screen_name := null;
    end if;

    if event_row ? 'occurred_at' then
      if jsonb_typeof(event_row -> 'occurred_at') is distinct from 'string'
         or nullif(btrim(event_row ->> 'occurred_at'), '') is null then
        raise exception using errcode = '22023', message = 'analytics_timestamp_invalid';
      end if;
      event_occurred_at := (btrim(event_row ->> 'occurred_at'))::timestamptz;
    else
      event_occurred_at := now();
    end if;
    if event_occurred_at < now() - interval '30 days'
       or event_occurred_at > now() + interval '10 minutes' then
      event_occurred_at := now();
    end if;

    insert into public.analytics_events (
      event_id,
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
      v_event_id,
      caller_profile_id,
      caller_family_id,
      v_child_profile_id,
      v_session_id,
      v_event_name,
      event_screen_name,
      event_properties,
      event_platform,
      event_app_version,
      event_occurred_at
    )
    on conflict (profile_id, event_id) do nothing;

    get diagnostics inserted_rows = row_count;
    inserted_count := inserted_count + inserted_rows;
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
session_rollups as (
  select
    event.profile_id,
    event.child_profile_id,
    event.session_id,
    count(*) filter (where event.event_name = 'session_start')::bigint as session_starts,
    coalesce(max(private.analytics_duration_seconds(event.properties)) filter (where event.event_name in ('session_checkpoint', 'session_end')), 0)::numeric as duration_seconds
  from public.analytics_events event
  where event.child_profile_id is not null
  group by event.profile_id, event.child_profile_id, event.session_id
),
session_stats as (
  select
    session_rollups.child_profile_id,
    coalesce(sum(session_rollups.session_starts), 0)::bigint as analytics_sessions,
    count(*) filter (where session_rollups.duration_seconds is not null)::bigint as sessions_observed,
    coalesce(sum(session_rollups.duration_seconds), 0)::bigint as analytics_session_seconds
  from session_rollups
  group by session_rollups.child_profile_id
),
event_stats as (
  select
    event.child_profile_id,
    count(*) filter (where event.event_name = 'screen_view')::bigint as screen_views,
    count(*) filter (where event.event_name = 'button_click')::bigint as button_clicks,
    count(*) filter (where event.event_name = 'tutorial_step')::bigint as tutorial_steps_seen,
    count(*) filter (where event.event_name = 'scene_enter')::bigint as scenes_entered,
    coalesce(sum(private.analytics_duration_seconds(event.properties)) filter (where event.event_name = 'scene_dwell'), 0)::bigint as scene_dwell_seconds,
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
  select child.id as child_profile_id, child.joined_at as activity_at from public.child_profiles child
  union all select task.child_profile_id, task.created_at from public.tasks task
  union all select task.child_profile_id, task.submitted_at from public.tasks task where task.submitted_at is not null
  union all select task.child_profile_id, task.completed_at from public.tasks task where task.completed_at is not null
  union all select task.child_profile_id, task.reviewed_at from public.tasks task where task.reviewed_at is not null
  union all select timer.child_profile_id, timer.created_at from public.adventure_timer_sessions timer
  union all select timer.child_profile_id, timer.updated_at from public.adventure_timer_sessions timer
  union all select ledger.child_profile_id, ledger.created_at from public.point_ledger ledger
  union all select redemption.child_profile_id, redemption.created_at from public.reward_redemptions redemption
  union all select purchase.child_profile_id, purchase.created_at from public.game_item_purchases purchase
  union all select unlock.child_profile_id, unlock.unlocked_at from public.child_world_scene_unlocks unlock
  union all select dialogue.child_profile_id, dialogue.last_talked_at from public.child_world_npc_dialogue_progress dialogue
  union all select request.requester_child_profile_id, request.created_at from public.child_friend_requests request
  union all select message.sender_child_profile_id, message.created_at from public.friend_world_messages message where message.status = 'visible'
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
  case when coalesce(task_stats.planned_tasks, 0) = 0 then 0 else round(100.0 * task_stats.completed_tasks / task_stats.planned_tasks, 1) end as task_completion_rate,
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
  coalesce(session_stats.analytics_sessions, 0) as analytics_sessions,
  coalesce(session_stats.analytics_session_seconds, 0) as analytics_session_seconds,
  coalesce(event_stats.screen_views, 0) as screen_views,
  coalesce(event_stats.button_clicks, 0) as button_clicks,
  coalesce(event_stats.tutorial_steps_seen, 0) as tutorial_steps_seen,
  coalesce(event_stats.scenes_entered, 0) as scenes_entered,
  coalesce(event_stats.scene_dwell_seconds, 0) as scene_dwell_seconds,
  last_screen_stats.last_screen_name,
  greatest(last_activity.last_known_domain_activity_at, event_stats.last_analytics_activity_at) as last_known_activity_at,
  coalesce(session_stats.sessions_observed, 0) as sessions_observed
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
left join session_stats on session_stats.child_profile_id = child.id
left join event_stats on event_stats.child_profile_id = child.id
left join last_screen_stats on last_screen_stats.child_profile_id = child.id
left join last_activity on last_activity.child_profile_id = child.id;

create or replace view private.analytics_daily_activity as
with domain_rows(child_profile_id, event_name, occurred_at) as (
  select child.id, 'child_joined'::text, child.joined_at from public.child_profiles child
  union all select task.child_profile_id, 'task_created', task.created_at from public.tasks task
  union all select task.child_profile_id, 'task_submitted', task.submitted_at from public.tasks task where task.submitted_at is not null
  union all select task.child_profile_id, 'task_completed', task.completed_at from public.tasks task where task.completed_at is not null
  union all select task.child_profile_id, 'task_reviewed', task.reviewed_at from public.tasks task where task.reviewed_at is not null
  union all select timer.child_profile_id, 'timer_started', timer.started_at from public.adventure_timer_sessions timer
  union all select timer.child_profile_id, 'timer_completed', timer.completed_at from public.adventure_timer_sessions timer where timer.completed_at is not null
  union all select ledger.child_profile_id, 'points_awarded', ledger.created_at from public.point_ledger ledger where ledger.entry_type = 'task_approved' and ledger.points_delta > 0
  union all select redemption.child_profile_id, 'reward_redeemed', redemption.created_at from public.reward_redemptions redemption
  union all select purchase.child_profile_id, 'game_purchase', purchase.created_at from public.game_item_purchases purchase
  union all select unlock.child_profile_id, 'scene_unlocked', unlock.unlocked_at from public.child_world_scene_unlocks unlock
  union all select dialogue.child_profile_id, 'npc_talked', dialogue.last_talked_at from public.child_world_npc_dialogue_progress dialogue
  union all select request.requester_child_profile_id, 'friend_request_sent', request.created_at from public.child_friend_requests request
  union all select message.sender_child_profile_id, 'chat_message_sent', message.created_at from public.friend_world_messages message where message.status = 'visible'
  union all select adventure.creator_child_profile_id, 'coop_adventure_created', adventure.created_at from public.coop_adventures adventure
  union all
  select participant.child_profile_id, 'coop_completion_submitted', completion.submitted_at
  from public.coop_adventure_completions completion
  join public.coop_adventure_participants participant on participant.id = completion.participant_id
  where completion.submitted_at is not null
),
analytics_rows as (
  select
    event.profile_id,
    event.child_profile_id,
    event.session_id,
    event.event_name,
    event.occurred_at,
    event.properties
  from public.analytics_events event
),
domain_daily as (
  select
    (row.occurred_at at time zone 'Asia/Taipei')::date as activity_date,
    count(*)::bigint as total_domain_events,
    count(distinct row.child_profile_id)::bigint as domain_active_children,
    count(*) filter (where row.event_name = 'task_created')::bigint as tasks_created,
    count(*) filter (where row.event_name = 'task_submitted')::bigint as tasks_submitted,
    count(*) filter (where row.event_name = 'task_completed')::bigint as tasks_completed,
    count(*) filter (where row.event_name = 'task_reviewed')::bigint as tasks_reviewed,
    count(*) filter (where row.event_name = 'timer_started')::bigint as timers_started,
    count(*) filter (where row.event_name = 'timer_completed')::bigint as timers_completed,
    count(*) filter (where row.event_name = 'points_awarded')::bigint as points_awarded,
    count(*) filter (where row.event_name = 'reward_redeemed')::bigint as rewards_redeemed,
    count(*) filter (where row.event_name = 'game_purchase')::bigint as game_purchases,
    count(*) filter (where row.event_name = 'scene_unlocked')::bigint as scenes_unlocked,
    count(*) filter (where row.event_name = 'npc_talked')::bigint as npc_talks,
    count(*) filter (where row.event_name = 'friend_request_sent')::bigint as friend_requests_sent,
    count(*) filter (where row.event_name = 'chat_message_sent')::bigint as chat_messages_sent,
    count(*) filter (where row.event_name = 'coop_adventure_created')::bigint as coop_adventures_created,
    count(*) filter (where row.event_name = 'coop_completion_submitted')::bigint as coop_completions_submitted
  from domain_rows row
  where row.occurred_at is not null
  group by (row.occurred_at at time zone 'Asia/Taipei')::date
),
analytics_daily as (
  select
    (row.occurred_at at time zone 'Asia/Taipei')::date as activity_date,
    count(*)::bigint as total_analytics_events,
    count(distinct row.profile_id) filter (where row.event_name in ('app_open', 'session_start', 'session_checkpoint', 'screen_view', 'button_click', 'tutorial_step', 'world_enter', 'world_exit', 'scene_enter', 'scene_exit', 'scene_dwell'))::bigint as active_users,
    count(*) filter (where row.event_name = 'app_open')::bigint as app_opens,
    count(*) filter (where row.event_name = 'session_start')::bigint as sessions_started,
    count(*) filter (where row.event_name = 'screen_view')::bigint as screen_views,
    count(*) filter (where row.event_name = 'button_click')::bigint as button_clicks,
    count(*) filter (where row.event_name = 'tutorial_step')::bigint as tutorial_steps,
    count(*) filter (where row.event_name = 'world_enter')::bigint as world_enters,
    count(*) filter (where row.event_name = 'scene_enter')::bigint as scene_enters,
    count(*) filter (where row.event_name = 'scene_exit')::bigint as scene_exits,
    coalesce(sum(private.analytics_duration_seconds(row.properties)) filter (where row.event_name = 'scene_dwell'), 0)::bigint as scene_dwell_seconds
  from analytics_rows row
  group by (row.occurred_at at time zone 'Asia/Taipei')::date
),
session_rollups as (
  select
    row.profile_id,
    row.child_profile_id,
    row.session_id,
    max(row.occurred_at) filter (where row.event_name in ('session_checkpoint', 'session_end')) as last_duration_at,
    max(private.analytics_duration_seconds(row.properties)) filter (where row.event_name in ('session_checkpoint', 'session_end')) as duration_seconds
  from analytics_rows row
  where row.event_name in ('session_checkpoint', 'session_end')
  group by row.profile_id, row.child_profile_id, row.session_id
),
session_daily as (
  select
    (rollup.last_duration_at at time zone 'Asia/Taipei')::date as activity_date,
    count(*) filter (where rollup.duration_seconds is not null)::bigint as sessions_with_duration,
    coalesce(sum(rollup.duration_seconds), 0)::bigint as session_seconds,
    coalesce(round(avg(rollup.duration_seconds) filter (where rollup.duration_seconds > 0), 1), 0)::numeric as avg_session_seconds,
    0::bigint as sessions_ended
  from session_rollups rollup
  where rollup.last_duration_at is not null
  group by (rollup.last_duration_at at time zone 'Asia/Taipei')::date
),
ended_sessions as (
  select
    (row.occurred_at at time zone 'Asia/Taipei')::date as activity_date,
    count(distinct (row.profile_id, row.session_id))::bigint as sessions_ended
  from analytics_rows row
  where row.event_name = 'session_end'
  group by (row.occurred_at at time zone 'Asia/Taipei')::date
),
activity_dates as (
  select activity_date from domain_daily
  union
  select activity_date from analytics_daily
  union
  select activity_date from session_daily
  union
  select activity_date from ended_sessions
)
select
  dates.activity_date,
  coalesce(domain.total_domain_events, 0)::bigint as total_domain_events,
  coalesce(analytics.total_analytics_events, 0)::bigint as total_analytics_events,
  coalesce(analytics.active_users, 0)::bigint as active_users,
  coalesce(domain.domain_active_children, 0)::bigint as domain_active_children,
  coalesce(analytics.app_opens, 0)::bigint as app_opens,
  coalesce(analytics.sessions_started, 0)::bigint as sessions_started,
  coalesce(ended.sessions_ended, 0)::bigint as sessions_ended,
  coalesce(session.session_seconds, 0)::bigint as session_seconds,
  coalesce(session.avg_session_seconds, 0)::numeric as avg_session_seconds,
  coalesce(analytics.screen_views, 0)::bigint as screen_views,
  coalesce(analytics.button_clicks, 0)::bigint as button_clicks,
  coalesce(analytics.tutorial_steps, 0)::bigint as tutorial_steps,
  coalesce(analytics.world_enters, 0)::bigint as world_enters,
  coalesce(analytics.scene_enters, 0)::bigint as scene_enters,
  coalesce(analytics.scene_exits, 0)::bigint as scene_exits,
  coalesce(analytics.scene_dwell_seconds, 0)::bigint as scene_dwell_seconds,
  coalesce(domain.tasks_created, 0)::bigint as tasks_created,
  coalesce(domain.tasks_submitted, 0)::bigint as tasks_submitted,
  coalesce(domain.tasks_completed, 0)::bigint as tasks_completed,
  coalesce(domain.tasks_reviewed, 0)::bigint as tasks_reviewed,
  coalesce(domain.timers_started, 0)::bigint as timers_started,
  coalesce(domain.timers_completed, 0)::bigint as timers_completed,
  coalesce(domain.points_awarded, 0)::bigint as points_awarded,
  coalesce(domain.rewards_redeemed, 0)::bigint as rewards_redeemed,
  coalesce(domain.game_purchases, 0)::bigint as game_purchases,
  coalesce(domain.scenes_unlocked, 0)::bigint as scenes_unlocked,
  coalesce(domain.npc_talks, 0)::bigint as npc_talks,
  coalesce(domain.friend_requests_sent, 0)::bigint as friend_requests_sent,
  coalesce(domain.chat_messages_sent, 0)::bigint as chat_messages_sent,
  coalesce(domain.coop_adventures_created, 0)::bigint as coop_adventures_created,
  coalesce(domain.coop_completions_submitted, 0)::bigint as coop_completions_submitted
from activity_dates dates
left join domain_daily domain on domain.activity_date = dates.activity_date
left join analytics_daily analytics on analytics.activity_date = dates.activity_date
left join session_daily session on session.activity_date = dates.activity_date
left join ended_sessions ended on ended.activity_date = dates.activity_date;

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
  where event.event_name in ('app_open', 'session_start', 'session_checkpoint', 'screen_view', 'button_click', 'tutorial_step', 'world_enter', 'world_exit', 'scene_enter', 'scene_exit', 'scene_dwell')
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
    else round(100.0 * count(distinct active_days.profile_id) / count(distinct first_open.profile_id), 1)
  end as retention_rate
from first_open
cross join day_offsets
left join active_days
  on active_days.profile_id = first_open.profile_id
 and active_days.activity_date = first_open.cohort_date + day_offsets.days_since_first_open
where first_open.cohort_date + day_offsets.days_since_first_open
      < (now() at time zone 'Asia/Taipei')::date
group by first_open.cohort_date, day_offsets.days_since_first_open;

create or replace view private.analytics_tutorial_funnel as
select
  private.analytics_tutorial_step(event.properties) as step_number,
  count(*)::bigint as step_events,
  count(distinct event.profile_id)::bigint as unique_users,
  count(*) filter (where event.properties ->> 'action' = 'skip')::bigint as skipped_events,
  count(*) filter (where event.properties ->> 'action' = 'complete')::bigint as completed_events
from public.analytics_events event
where event.event_name = 'tutorial_step'
  and private.analytics_tutorial_step(event.properties) is not null
group by private.analytics_tutorial_step(event.properties);

create or replace view private.analytics_scene_funnel as
select
  coalesce(nullif(event.properties ->> 'scene', ''), '未命名場景') as scene_name,
  count(*) filter (where event.event_name = 'scene_enter')::bigint as scene_enters,
  count(*) filter (where event.event_name = 'scene_exit')::bigint as scene_exits,
  count(distinct event.profile_id)::bigint as unique_users,
  coalesce(sum(private.analytics_duration_seconds(event.properties)) filter (where event.event_name = 'scene_dwell'), 0)::bigint as dwell_seconds,
  coalesce(round(
    sum(private.analytics_duration_seconds(event.properties)) filter (where event.event_name = 'scene_dwell')
    / nullif(count(*) filter (where event.event_name = 'scene_enter'), 0),
    1
  ), 0)::numeric as avg_dwell_seconds
from public.analytics_events event
where event.event_name in ('scene_enter', 'scene_exit', 'scene_dwell')
group by coalesce(nullif(event.properties ->> 'scene', ''), '未命名場景');

-- Keep analytics objects inaccessible directly; the public admin RPC remains
-- the only dashboard entry point and checks auth.users itself.
revoke all on private.analytics_child_summary from public, anon, authenticated;
revoke all on private.analytics_daily_activity from public, anon, authenticated;
revoke all on private.analytics_retention from public, anon, authenticated;
revoke all on private.analytics_tutorial_funnel from public, anon, authenticated;
revoke all on private.analytics_scene_funnel from public, anon, authenticated;
