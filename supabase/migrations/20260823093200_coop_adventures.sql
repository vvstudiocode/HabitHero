-- Phase 5: cooperative adventures are relation records around existing general
-- tasks. Every participant owns a normal task in their own family; the coop
-- tables only coordinate the relation and never replace the task/review flow.

create table public.coop_adventures (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  world_owner_child_profile_id uuid not null,
  creator_child_profile_id uuid not null,
  task_id uuid not null,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  adventure_type text not null default 'general' check (adventure_type = 'general'),
  is_daily boolean not null default false check (is_daily = false),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  unique (family_id, id),
  foreign key (family_id, world_owner_child_profile_id)
    references public.child_profiles (family_id, id) on delete cascade,
  foreign key (family_id, creator_child_profile_id)
    references public.child_profiles (family_id, id) on delete cascade,
  foreign key (family_id, task_id)
    references public.tasks (family_id, id) on delete cascade
);

create index coop_adventures_world_status_idx
  on public.coop_adventures (world_owner_child_profile_id, status, created_at desc);

create table public.coop_adventure_participants (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  coop_adventure_id uuid not null references public.coop_adventures(id) on delete cascade,
  child_profile_id uuid not null,
  task_id uuid not null,
  role text not null default 'participant' check (role in ('creator', 'participant')),
  joined_at timestamptz not null default timezone('utc', now()),
  unique (family_id, id),
  unique (coop_adventure_id, child_profile_id),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id) on delete cascade,
  foreign key (family_id, task_id)
    references public.tasks (family_id, id) on delete cascade
);

create index coop_adventure_participants_adventure_idx
  on public.coop_adventure_participants (coop_adventure_id, joined_at);

create table public.coop_adventure_completions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  coop_adventure_id uuid not null,
  participant_id uuid not null,
  idempotency_key uuid not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'revision_requested')),
  quick_report text check (quick_report is null or quick_report in ('smooth', 'hard', 'help')),
  reflection text check (reflection is null or char_length(reflection) <= 2000),
  mood text check (mood is null or char_length(mood) <= 40),
  difficulty integer check (difficulty is null or difficulty between 1 and 5),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  unique (family_id, id),
  unique (participant_id),
  unique (participant_id, idempotency_key),
  foreign key (participant_id)
    references public.coop_adventure_participants(id) on delete cascade
);

create index coop_adventure_completions_adventure_idx
  on public.coop_adventure_completions (coop_adventure_id, submitted_at desc);

create or replace function private.enforce_coop_completion_family()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  participant_row public.coop_adventure_participants;
begin
  select participant.* into participant_row
    from public.coop_adventure_participants participant
   where participant.id = new.participant_id;
  if not found
     or participant_row.family_id <> new.family_id
     or participant_row.coop_adventure_id <> new.coop_adventure_id then
    raise exception 'cooperative completion relation is invalid' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger coop_completion_family_guard
before insert or update on public.coop_adventure_completions
for each row execute function private.enforce_coop_completion_family();

alter table public.coop_adventures enable row level security;
alter table public.coop_adventure_participants enable row level security;
alter table public.coop_adventure_completions enable row level security;

-- Visitors read only safe RPC projections. Direct table grants are kept off so
-- family_id/task_id cannot become an accidental cross-family data surface.
revoke all on table public.coop_adventures from public, anon, authenticated;
revoke all on table public.coop_adventure_participants from public, anon, authenticated;
revoke all on table public.coop_adventure_completions from public, anon, authenticated;

create policy coop_adventures_parent_select on public.coop_adventures
  for select to authenticated using (private.is_family_parent(family_id));
create policy coop_participants_parent_select on public.coop_adventure_participants
  for select to authenticated using (private.is_family_parent(family_id));
create policy coop_completions_parent_select on public.coop_adventure_completions
  for select to authenticated using (private.is_family_parent(family_id));

create or replace function public.create_coop_adventure(target_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  creator_child public.child_profiles;
  task_row public.tasks;
  adventure_row public.coop_adventures;
  participant_row public.coop_adventure_participants;
begin
  select child.* into creator_child
    from public.child_profiles child
   where child.profile_id = (select auth.uid())
   limit 1;
  select task.* into task_row
    from public.tasks task
   where task.id = target_task_id
     and task.family_id = creator_child.family_id
     and task.child_profile_id = creator_child.id
   for update;

  if creator_child.id is null
     or task_row.id is null
     or task_row.adventure_type <> 'general'
     or task_row.is_daily is true then
    raise exception 'cooperative adventure is unavailable' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(task_row.child_profile_id::text, 0));
  if not (
    select count(*) < 5
      from public.coop_adventures existing
     where existing.world_owner_child_profile_id = task_row.child_profile_id
       and existing.status = 'active'
  ) then
    raise exception 'cooperative adventure is unavailable' using errcode = 'P0001';
  end if;

  insert into public.coop_adventures (
    family_id, world_owner_child_profile_id, creator_child_profile_id, task_id,
    title, description, adventure_type, is_daily
  ) values (
    task_row.family_id, task_row.child_profile_id, creator_child.id, task_row.id,
    task_row.name, left(coalesce(task_row.description, ''), 500), task_row.adventure_type, task_row.is_daily
  ) returning * into adventure_row;

  insert into public.coop_adventure_participants (
    family_id, coop_adventure_id, child_profile_id, task_id, role
  ) values (
    creator_child.family_id, adventure_row.id, creator_child.id, task_row.id, 'creator'
  ) returning * into participant_row;

  perform realtime.send(
    jsonb_build_object(
      'version', 1,
      'event', 'coop_changed_v1',
      'type', 'coop_adventure_created',
      'coop_adventure_id', adventure_row.id,
      'world_owner_child_profile_id', adventure_row.world_owner_child_profile_id,
      'creator_child_profile_id', creator_child.id
    ),
    'coop_changed_v1',
    'friend-world:' || adventure_row.world_owner_child_profile_id::text,
    true
  );

  return jsonb_build_object(
    'coop_adventure_id', adventure_row.id,
    'world_owner_child_profile_id', adventure_row.world_owner_child_profile_id,
    'creator_child_profile_id', creator_child.id,
    'title', adventure_row.title,
    'created_at', adventure_row.created_at
  );
end;
$$;

create or replace function public.join_coop_adventure(target_coop_adventure_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  joining_child public.child_profiles;
  adventure_row public.coop_adventures;
  source_task public.tasks;
  group_row public.adventure_groups;
  participant_row public.coop_adventure_participants;
  visitor_task public.tasks;
begin
  select child.* into joining_child
    from public.child_profiles child
   where child.profile_id = (select auth.uid())
   limit 1;
  select adventure.* into adventure_row
    from public.coop_adventures adventure
   where adventure.id = target_coop_adventure_id
     and private.can_visit_friend_world((select auth.uid()), adventure.world_owner_child_profile_id)
   for update;

  if joining_child.id is null
     or adventure_row.id is null
     or adventure_row.status <> 'active' then
    raise exception 'cooperative adventure is unavailable' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(adventure_row.id::text, 0));
  select existing.* into participant_row
    from public.coop_adventure_participants existing
   where existing.coop_adventure_id = adventure_row.id
     and existing.child_profile_id = joining_child.id
   for update;
  if found then
    return jsonb_build_object(
      'coop_adventure_id', adventure_row.id,
      'participant_id', participant_row.id,
      'status', 'joined'
    );
  end if;

  if not (
    select count(*) < 8
      from public.coop_adventure_participants existing
     where existing.coop_adventure_id = adventure_row.id
  ) then
    raise exception 'cooperative adventure is unavailable' using errcode = 'P0001';
  end if;

  select task.* into source_task
    from public.tasks task
   where task.id = adventure_row.task_id
     and task.family_id = adventure_row.family_id;
  if source_task.id is null
     or source_task.adventure_type <> 'general'
     or source_task.is_daily then
    raise exception 'cooperative adventure source is unavailable' using errcode = '42501';
  end if;

  -- The visitor gets a real general task in their own family. This is the
  -- crucial boundary: no owner family_id/task_id is ever inserted here.
  -- The participant relation remains family_id, child_profile_id, task_id scoped.
  group_row := private.ensure_active_general_group(joining_child.family_id, joining_child.id);
  insert into public.tasks (
    family_id, child_profile_id, name, description, points, status, icon,
    duration_minutes, is_daily, due_on, due_time, end_time, category, origin,
    original_name, original_points, adventure_type, adventure_group_id,
    occurrence_date, completion_report_mode, requires_timer, execution_timezone,
    requires_review_before_next_task
  ) values (
    joining_child.family_id, joining_child.id, source_task.name,
    left(coalesce(source_task.description, ''), 2000), greatest(0, source_task.points),
    'todo', source_task.icon, source_task.duration_minutes, false,
    coalesce(source_task.due_on, (timezone('Asia/Taipei', now()))::date),
    source_task.due_time, source_task.end_time, source_task.category, 'parent_assigned',
    source_task.name, greatest(0, source_task.points), 'general', group_row.id,
    null, coalesce(source_task.completion_report_mode, 'quick'),
    coalesce(source_task.requires_timer, false), coalesce(source_task.execution_timezone, 'Asia/Taipei'),
    coalesce(source_task.requires_review_before_next_task, false)
  ) returning * into visitor_task;

  insert into public.coop_adventure_participants (
    family_id, coop_adventure_id, child_profile_id, task_id, role
  ) values (
    joining_child.family_id, adventure_row.id, joining_child.id, visitor_task.id, 'participant'
  ) returning * into participant_row;

  perform realtime.send(
    jsonb_build_object(
      'version', 1,
      'event', 'coop_changed_v1',
      'type', 'coop_participant_joined',
      'coop_adventure_id', adventure_row.id,
      'participant_id', participant_row.id
    ),
    'coop_changed_v1',
    'friend-world:' || adventure_row.world_owner_child_profile_id::text,
    true
  );
  return jsonb_build_object('coop_adventure_id', adventure_row.id, 'participant_id', participant_row.id, 'status', 'joined');
end;
$$;

create or replace function public.submit_coop_adventure_completion(
  target_participant_id uuid,
  idempotency_key uuid,
  quick_report text default null,
  reflection text default null,
  mood text default null,
  difficulty integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_child public.child_profiles;
  participant_row public.coop_adventure_participants;
  completion_row public.coop_adventure_completions;
begin
  select child.* into actor_child
    from public.child_profiles child
   where child.profile_id = (select auth.uid())
   limit 1;
  select participant.* into participant_row
    from public.coop_adventure_participants participant
   where participant.id = target_participant_id
     and participant.child_profile_id = actor_child.id
   for update;

  if actor_child.id is null or not found or idempotency_key is null then
    raise exception 'cooperative completion is unavailable' using errcode = '42501';
  end if;
  if quick_report is not null and quick_report not in ('smooth', 'hard', 'help') then
    raise exception 'cooperative completion is unavailable' using errcode = '22023';
  end if;
  if difficulty is not null and difficulty not between 1 and 5 then
    raise exception 'cooperative completion is unavailable' using errcode = '22023';
  end if;

  select completion.* into completion_row
    from public.coop_adventure_completions completion
   where completion.participant_id = participant_row.id
   for update;
  if found and completion_row.status = 'completed' then
    return jsonb_build_object(
      'coop_adventure_id', participant_row.coop_adventure_id,
      'participant_id', participant_row.id,
      'completion_id', completion_row.id,
      'status', 'completed'
    );
  end if;

  insert into public.coop_adventure_completions (
    family_id, coop_adventure_id, participant_id, idempotency_key,
    quick_report, reflection, mood, difficulty, status, submitted_at
  ) values (
    participant_row.family_id, participant_row.coop_adventure_id, participant_row.id, idempotency_key,
    quick_report, nullif(trim(reflection), ''), nullif(trim(mood), ''), difficulty, 'pending', timezone('utc', now())
  )
  on conflict (participant_id) do update set
    idempotency_key = excluded.idempotency_key,
    quick_report = excluded.quick_report,
    reflection = excluded.reflection,
    mood = excluded.mood,
    difficulty = excluded.difficulty,
    status = 'pending',
    submitted_at = excluded.submitted_at,
    reviewed_at = null
  returning * into completion_row;

  -- The normal task RPC performs the family-scoped execution-window and
  -- report validation, then the normal parent review RPC awards points.
  perform public.submit_adventure_completion(
    participant_row.task_id,
    idempotency_key,
    quick_report,
    reflection,
    mood,
    difficulty::smallint
  );

  perform realtime.send(
    jsonb_build_object(
      'version', 1,
      'event', 'coop_changed_v1',
      'type', 'coop_completion_submitted',
      'coop_adventure_id', participant_row.coop_adventure_id,
      'participant_id', participant_row.id
    ),
    'coop_changed_v1',
    'friend-world:' || (select adventure.world_owner_child_profile_id::text from public.coop_adventures adventure where adventure.id = participant_row.coop_adventure_id),
    true
  );
  return jsonb_build_object('coop_adventure_id', participant_row.coop_adventure_id, 'participant_id', participant_row.id, 'completion_id', completion_row.id, 'status', completion_row.status);
end;
$$;

create or replace function public.review_coop_adventure_completion(
  target_participant_id uuid,
  approved boolean,
  approved_points integer default null,
  feedback text default null,
  correction text default null,
  tone text default null,
  revision_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  participant_row public.coop_adventure_participants;
  completion_row public.coop_adventure_completions;
  reviewed_task public.tasks;
begin
  select participant.* into participant_row
    from public.coop_adventure_participants participant
   where participant.id = target_participant_id
   for update;
  if not found
     or not private.is_family_parent(participant_row.family_id)
     or approved is null then
    raise exception 'cooperative completion is unavailable' using errcode = '42501';
  end if;
  if not exists (
    select 1
      from public.child_profiles child
     where child.id = participant_row.child_profile_id
       and child.family_id = participant_row.family_id
  ) then
    raise exception 'cooperative completion is unavailable' using errcode = '42501';
  end if;

  select completion.* into completion_row
    from public.coop_adventure_completions completion
   where completion.participant_id = participant_row.id
   for update;
  if not found then
    raise exception 'cooperative completion is unavailable' using errcode = '42501';
  end if;
  if completion_row.status = 'completed' then
    if approved then
      return jsonb_build_object('coop_adventure_id', participant_row.coop_adventure_id, 'participant_id', participant_row.id, 'completion_id', completion_row.id, 'status', 'completed');
    end if;
    raise exception 'completed cooperative completion is immutable' using errcode = 'P0001';
  end if;

  reviewed_task := public.review_adventure_completion(
    participant_row.task_id,
    approved,
    approved_points,
    feedback,
    correction,
    tone,
    revision_note
  );

  update public.coop_adventure_completions
     set status = case when approved then 'completed' else 'revision_requested' end,
         reviewed_at = timezone('utc', now())
   where id = completion_row.id
   returning * into completion_row;

  if approved and not exists (
    select 1
      from public.coop_adventure_participants participant
      left join public.coop_adventure_completions completion
        on completion.participant_id = participant.id
     where participant.coop_adventure_id = participant_row.coop_adventure_id
       and (completion.id is null or completion.status <> 'completed')
  ) then
    update public.coop_adventures
       set status = 'completed', completed_at = timezone('utc', now())
     where id = participant_row.coop_adventure_id
       and status = 'active';
  end if;

  perform realtime.send(
    jsonb_build_object(
      'version', 1,
      'event', 'coop_changed_v1',
      'type', 'coop_completion_reviewed',
      'coop_adventure_id', participant_row.coop_adventure_id,
      'participant_id', participant_row.id
    ),
    'coop_changed_v1',
    'friend-world:' || (select adventure.world_owner_child_profile_id::text from public.coop_adventures adventure where adventure.id = participant_row.coop_adventure_id),
    true
  );
  return jsonb_build_object('coop_adventure_id', participant_row.coop_adventure_id, 'participant_id', participant_row.id, 'completion_id', completion_row.id, 'status', completion_row.status);
end;
$$;

create or replace function public.list_coop_adventures(target_world_owner_child_profile_id uuid)
returns setof jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id', adventure.id,
    'world_owner_child_profile_id', adventure.world_owner_child_profile_id,
    'title', adventure.title,
    'description', adventure.description,
    'status', adventure.status,
    'participant_count', (select count(*) from public.coop_adventure_participants participant where participant.coop_adventure_id = adventure.id),
    'created_at', adventure.created_at,
    'completed_at', adventure.completed_at
  )
    from public.coop_adventures adventure
   where adventure.world_owner_child_profile_id = target_world_owner_child_profile_id
     and (private.is_family_parent(adventure.family_id)
       or private.can_visit_friend_world((select auth.uid()), adventure.world_owner_child_profile_id))
   order by adventure.created_at desc;
$$;

create or replace function public.get_coop_adventure_state(target_coop_adventure_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'adventures', jsonb_build_array(jsonb_build_object(
      'id', adventure.id,
      'world_owner_child_profile_id', adventure.world_owner_child_profile_id,
      'title', adventure.title,
      'description', adventure.description,
      'status', adventure.status,
      'participant_count', (select count(*) from public.coop_adventure_participants participant where participant.coop_adventure_id = adventure.id),
      'created_at', adventure.created_at,
      'completed_at', adventure.completed_at
    )),
    'participants', coalesce((select jsonb_agg(jsonb_build_object(
      'id', participant.id,
      'coop_adventure_id', participant.coop_adventure_id,
      'child_profile_id', participant.child_profile_id,
      'display_name', child.display_name,
      'role', participant.role,
      'joined_at', participant.joined_at
    ) order by participant.joined_at) from public.coop_adventure_participants participant join public.child_profiles child on child.id = participant.child_profile_id where participant.coop_adventure_id = adventure.id), '[]'::jsonb),
    'completions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', completion.id,
      'coop_adventure_id', completion.coop_adventure_id,
      'participant_id', completion.participant_id,
      'status', completion.status,
      'submitted_at', completion.submitted_at,
      'reviewed_at', completion.reviewed_at
    ) order by completion.submitted_at) from public.coop_adventure_completions completion where completion.coop_adventure_id = adventure.id), '[]'::jsonb),
    'synced_at', timezone('utc', now())
  )
    from public.coop_adventures adventure
   where adventure.id = target_coop_adventure_id
     and (private.is_family_parent(adventure.family_id)
       or private.can_visit_friend_world((select auth.uid()), adventure.world_owner_child_profile_id));
$$;

revoke all on function public.create_coop_adventure(uuid) from public, anon;
revoke all on function public.join_coop_adventure(uuid) from public, anon;
revoke all on function public.submit_coop_adventure_completion(uuid, uuid, text, text, text, integer) from public, anon;
revoke all on function public.review_coop_adventure_completion(uuid, boolean, integer, text, text, text, text) from public, anon;
revoke all on function public.list_coop_adventures(uuid) from public, anon;
revoke all on function public.get_coop_adventure_state(uuid) from public, anon;
grant execute on function public.create_coop_adventure(uuid) to authenticated;
grant execute on function public.join_coop_adventure(uuid) to authenticated;
grant execute on function public.submit_coop_adventure_completion(uuid, uuid, text, text, text, integer) to authenticated;
grant execute on function public.review_coop_adventure_completion(uuid, boolean, integer, text, text, text, text) to authenticated;
grant execute on function public.list_coop_adventures(uuid) to authenticated;
grant execute on function public.get_coop_adventure_state(uuid) to authenticated;
