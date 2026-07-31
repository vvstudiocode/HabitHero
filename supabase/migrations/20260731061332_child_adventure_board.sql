-- Child adventure board: schedules, immutable daily occurrences, server timers,
-- completion reporting, and idempotent point approval.

create table public.adventure_groups (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_profile_id uuid not null,
  type text not null default 'general' check (type = 'general'),
  title text not null default '一般冒險',
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  archived_at timestamptz,
  unique (family_id, id),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id)
    on delete cascade,
  check (
    char_length(trim(title)) between 1 and 24
    and title <> '每日冒險'
    and title ~ '[[:alnum:]\u4e00-\u9fff]'
  ),
  check (
    (status = 'active' and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  )
);

create unique index adventure_groups_one_active_general_per_child
  on public.adventure_groups (child_profile_id)
  where type = 'general' and status = 'active';

create table public.task_schedules (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_profile_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text,
  points integer not null check (points >= 0),
  icon text not null default 'Target' check (char_length(trim(icon)) between 1 and 32),
  category text not null default 'life_habit'
    check (category in ('life_habit', 'learning', 'health', 'relationship', 'family_contribution', 'creativity')),
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 1440),
  start_time time,
  end_time time,
  weekdays smallint[] not null,
  timezone text not null default 'Asia/Taipei',
  requires_timer boolean not null default false,
  requires_review_before_next_task boolean not null default false,
  active_from date not null,
  active_until date,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (family_id, id),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id)
    on delete cascade,
  check (description is null or char_length(description) <= 2000),
  check (cardinality(weekdays) between 1 and 7),
  check (weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]),
  check (timezone = 'Asia/Taipei'),
  check (start_time is null or end_time is null or end_time > start_time),
  check (active_until is null or active_until >= active_from),
  check (not requires_timer or duration_minutes is not null)
);

create index task_schedules_child_active_date_idx
  on public.task_schedules (child_profile_id, is_active, active_from, active_until);

alter table public.tasks
  add column adventure_type text not null default 'general',
  add column adventure_group_id uuid,
  add column schedule_id uuid,
  add column occurrence_date date,
  add column completion_report_mode text not null default 'reflection',
  add column quick_report text,
  add column requires_timer boolean not null default false,
  add column description text,
  add column execution_timezone text not null default 'Asia/Taipei',
  add column completion_idempotency_key uuid;

-- Preserve legacy daily rows as immutable occurrences instead of resetting them.
-- Each legacy task receives a schedule anchor with the same UUID.
insert into public.task_schedules (
  id, family_id, child_profile_id, name, points, icon, category,
  duration_minutes, start_time, end_time, weekdays, timezone,
  requires_timer, requires_review_before_next_task, active_from, active_until,
  is_active
)
select
  task.id,
  task.family_id,
  task.child_profile_id,
  task.name,
  task.points,
  task.icon,
  task.category,
  task.duration_minutes,
  task.due_time,
  task.end_time,
  array[1, 2, 3, 4, 5, 6, 7]::smallint[],
  'Asia/Taipei',
  false,
  task.requires_review_before_next_task,
  coalesce(task.due_on, (timezone('Asia/Taipei', task.created_at))::date),
  coalesce(task.due_on, (timezone('Asia/Taipei', task.created_at))::date),
  false
from public.tasks task
where task.is_daily
on conflict (id) do nothing;

update public.tasks
set adventure_type = 'daily',
    schedule_id = id,
    occurrence_date = coalesce(due_on, (timezone('Asia/Taipei', created_at))::date),
    completion_report_mode = 'none'
where is_daily;

alter table public.tasks
  drop constraint if exists tasks_points_check,
  drop constraint if exists tasks_original_points_check;

alter table public.tasks
  add constraint tasks_points_check check (points >= 0),
  add constraint tasks_original_points_check check (original_points is null or original_points >= 0),
  add constraint tasks_adventure_type_check check (adventure_type in ('daily', 'general')),
  add constraint tasks_completion_report_mode_check check (completion_report_mode in ('none', 'quick', 'reflection')),
  add constraint tasks_quick_report_check check (quick_report is null or quick_report in ('smooth', 'hard', 'help')),
  add constraint tasks_adventure_group_fk
    foreign key (family_id, adventure_group_id)
    references public.adventure_groups (family_id, id)
    on delete restrict,
  add constraint tasks_schedule_fk
    foreign key (family_id, schedule_id)
    references public.task_schedules (family_id, id)
    on delete restrict,
  add constraint tasks_adventure_shape_check check (
    (
      adventure_type = 'daily'
      and schedule_id is not null
      and occurrence_date is not null
      and completion_report_mode = 'none'
      and adventure_group_id is null
      and is_daily
    )
    or (
      adventure_type = 'general'
      and schedule_id is null
      and completion_report_mode in ('quick', 'reflection')
      and not is_daily
    )
  ),
  add constraint tasks_timer_shape_check check (
    not requires_timer or duration_minutes is not null
  );

create unique index tasks_daily_occurrence_unique
  on public.tasks (schedule_id, child_profile_id, occurrence_date)
  where schedule_id is not null;

create index tasks_child_adventure_date_idx
  on public.tasks (child_profile_id, adventure_type, occurrence_date, status);

create table public.adventure_timer_sessions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_profile_id uuid not null,
  task_id uuid not null,
  status text not null default 'running' check (status in ('running', 'paused', 'completed')),
  accumulated_seconds integer not null default 0 check (accumulated_seconds >= 0),
  started_at timestamptz not null default timezone('utc', now()),
  last_resumed_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (family_id, id),
  unique (task_id),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id)
    on delete cascade,
  foreign key (family_id, task_id)
    references public.tasks (family_id, id)
    on delete cascade,
  check (
    (status = 'running' and last_resumed_at is not null and paused_at is null and completed_at is null)
    or (status = 'paused' and last_resumed_at is null and paused_at is not null and completed_at is null)
    or (status = 'completed' and last_resumed_at is null and completed_at is not null)
  )
);

create unique index adventure_timer_one_running_per_child
  on public.adventure_timer_sessions (child_profile_id)
  where status = 'running';

create table private.adventure_completion_submissions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  idempotency_key uuid not null,
  submitted_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (task_id, idempotency_key)
);

create trigger adventure_groups_updated_at
  before update on public.adventure_groups
  for each row execute function private.touch_updated_at();

create trigger task_schedules_updated_at
  before update on public.task_schedules
  for each row execute function private.touch_updated_at();

create trigger adventure_timer_sessions_updated_at
  before update on public.adventure_timer_sessions
  for each row execute function private.touch_updated_at();

alter table public.adventure_groups enable row level security;
alter table public.task_schedules enable row level security;
alter table public.adventure_timer_sessions enable row level security;

create policy adventure_groups_select
  on public.adventure_groups for select to authenticated
  using (
    private.is_family_parent(family_id)
    or private.is_child_owner(family_id, child_profile_id)
  );

create policy task_schedules_select
  on public.task_schedules for select to authenticated
  using (
    private.is_family_parent(family_id)
    or private.is_child_owner(family_id, child_profile_id)
  );

create policy adventure_timer_sessions_select
  on public.adventure_timer_sessions for select to authenticated
  using (
    private.is_family_parent(family_id)
    or private.is_child_owner(family_id, child_profile_id)
  );

revoke all on table public.adventure_groups from public, anon;
revoke all on table public.task_schedules from public, anon;
revoke all on table public.adventure_timer_sessions from public, anon;
revoke all on table private.adventure_completion_submissions from public, anon, authenticated;
grant select on table public.adventure_groups to authenticated;
grant select on table public.task_schedules to authenticated;
grant select on table public.adventure_timer_sessions to authenticated;

-- Children submit through the completion RPC. Removing the direct UPDATE policy
-- prevents clients from choosing protected report, timer, status, or point fields.
drop policy if exists tasks_update_child on public.tasks;
drop trigger if exists tasks_submission_guard on public.tasks;

create or replace function private.validate_adventure_group_title(target_title text)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  normalized_title text := trim(target_title);
begin
  if normalized_title is null
     or char_length(normalized_title) not between 1 and 24
     or normalized_title = '每日冒險'
     or normalized_title !~ '[[:alnum:]\u4e00-\u9fff]' then
    raise exception 'adventure group title is invalid' using errcode = '22023';
  end if;
  return normalized_title;
end;
$$;

create or replace function private.adventure_execution_is_open(task_row public.tasks)
returns boolean
language sql
stable
set search_path = pg_catalog
as $$
  select
    case
      when task_row.adventure_type = 'daily' then
        task_row.occurrence_date = (timezone(task_row.execution_timezone, now()))::date
      when task_row.due_on is not null then
        task_row.due_on = (timezone(task_row.execution_timezone, now()))::date
      else true
    end
    and (
      task_row.due_time is null
      or (timezone(task_row.execution_timezone, now()))::time >= task_row.due_time
    )
    and (
      task_row.end_time is null
      or (timezone(task_row.execution_timezone, now()))::time < task_row.end_time
    );
$$;

revoke all on function private.validate_adventure_group_title(text) from public, anon, authenticated;
revoke all on function private.adventure_execution_is_open(public.tasks) from public, anon, authenticated;

create or replace function private.ensure_active_general_group(
  target_family_id uuid,
  target_child_profile_id uuid
)
returns public.adventure_groups
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  group_row public.adventure_groups;
begin
  insert into public.adventure_groups (family_id, child_profile_id, type, title)
  values (target_family_id, target_child_profile_id, 'general', '一般冒險')
  on conflict (child_profile_id)
    where type = 'general' and status = 'active'
    do nothing;

  select * into group_row
    from public.adventure_groups
   where family_id = target_family_id
     and child_profile_id = target_child_profile_id
     and type = 'general'
     and status = 'active';

  if not found then
    raise exception 'active adventure group could not be created' using errcode = '23514';
  end if;
  return group_row;
end;
$$;

revoke all on function private.ensure_active_general_group(uuid, uuid) from public, anon, authenticated;

create function public.create_adventure_schedule(
  target_family_id uuid,
  target_child_profile_id uuid,
  schedule_name text,
  schedule_description text,
  schedule_points integer,
  schedule_icon text,
  schedule_category text,
  schedule_duration_minutes integer,
  schedule_start_time time,
  schedule_end_time time,
  schedule_weekdays smallint[],
  schedule_timezone text,
  schedule_requires_timer boolean,
  schedule_requires_review_before_next_task boolean,
  schedule_active_from date,
  schedule_active_until date default null
)
returns public.task_schedules
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  schedule_row public.task_schedules;
  normalized_name text := trim(schedule_name);
  normalized_description text := nullif(trim(schedule_description), '');
  normalized_icon text := coalesce(nullif(trim(schedule_icon), ''), 'Target');
begin
  if (select auth.uid()) is null
     or not private.is_family_parent(target_family_id) then
    raise exception 'schedule not found or not authorized' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.child_profiles child
     where child.family_id = target_family_id
       and child.id = target_child_profile_id
  ) then
    raise exception 'child profile not found' using errcode = '22023';
  end if;
  if normalized_name is null or char_length(normalized_name) not between 1 and 120 then
    raise exception 'schedule name is invalid' using errcode = '22023';
  end if;
  if normalized_description is not null and char_length(normalized_description) > 2000 then
    raise exception 'schedule description is invalid' using errcode = '22023';
  end if;
  if schedule_points is null or schedule_points < 0 then
    raise exception 'schedule points must be nonnegative' using errcode = '22023';
  end if;
  if char_length(normalized_icon) not between 1 and 32 then
    raise exception 'schedule icon is invalid' using errcode = '22023';
  end if;
  if schedule_category not in ('life_habit', 'learning', 'health', 'relationship', 'family_contribution', 'creativity') then
    raise exception 'schedule category is invalid' using errcode = '22023';
  end if;
  if schedule_duration_minutes is not null
     and schedule_duration_minutes not between 1 and 1440 then
    raise exception 'schedule duration is invalid' using errcode = '22023';
  end if;
  if coalesce(schedule_requires_timer, false) and schedule_duration_minutes is null then
    raise exception 'timer schedules require a duration' using errcode = '22023';
  end if;
  if schedule_start_time is not null
     and schedule_end_time is not null
     and schedule_end_time <= schedule_start_time then
    raise exception 'schedule execution window is invalid' using errcode = '22023';
  end if;
  if schedule_weekdays is null
     or cardinality(schedule_weekdays) not between 1 and 7
     or not schedule_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[] then
    raise exception 'schedule weekdays are invalid' using errcode = '22023';
  end if;
  if schedule_timezone is distinct from 'Asia/Taipei' then
    raise exception 'schedule timezone is unsupported' using errcode = '22023';
  end if;
  if schedule_active_from is null
     or (schedule_active_until is not null and schedule_active_until < schedule_active_from) then
    raise exception 'schedule active dates are invalid' using errcode = '22023';
  end if;

  insert into public.task_schedules (
    family_id, child_profile_id, name, description, points, icon, category,
    duration_minutes, start_time, end_time, weekdays, timezone, requires_timer,
    requires_review_before_next_task, active_from, active_until
  ) values (
    target_family_id, target_child_profile_id, normalized_name,
    normalized_description, schedule_points, normalized_icon, schedule_category,
    schedule_duration_minutes, schedule_start_time, schedule_end_time,
    schedule_weekdays, schedule_timezone, coalesce(schedule_requires_timer, false),
    coalesce(schedule_requires_review_before_next_task, false),
    schedule_active_from, schedule_active_until
  )
  returning * into schedule_row;
  return schedule_row;
end;
$$;

create function public.update_adventure_schedule(
  target_schedule_id uuid,
  schedule_name text,
  schedule_description text,
  schedule_points integer,
  schedule_icon text,
  schedule_category text,
  schedule_duration_minutes integer,
  schedule_start_time time,
  schedule_end_time time,
  schedule_weekdays smallint[],
  schedule_timezone text,
  schedule_requires_timer boolean,
  schedule_requires_review_before_next_task boolean,
  schedule_active_from date,
  schedule_active_until date default null,
  update_scope text default 'from_tomorrow'
)
returns public.task_schedules
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_row public.task_schedules;
  updated_row public.task_schedules;
  taipei_today date := (timezone('Asia/Taipei', now()))::date;
  scoped_from_date date;
  effective_active_from date;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into current_row
    from public.task_schedules
   where id = target_schedule_id
   for update;
  if not found or not private.is_family_parent(current_row.family_id) then
    raise exception 'schedule not found or not authorized' using errcode = '42501';
  end if;
  if update_scope not in ('today_unfinished', 'from_tomorrow', 'today_and_future') then
    raise exception 'schedule update scope is invalid' using errcode = '22023';
  end if;
  scoped_from_date := case
    when update_scope = 'from_tomorrow' then taipei_today + 1
    else taipei_today
  end;
  effective_active_from := case
    when update_scope = 'from_tomorrow'
      then greatest(schedule_active_from, taipei_today + 1)
    else schedule_active_from
  end;

  -- Validate the replacement using the same domain rules as creation.
  if trim(schedule_name) is null or char_length(trim(schedule_name)) not between 1 and 120
     or schedule_points is null or schedule_points < 0
     or schedule_category not in ('life_habit', 'learning', 'health', 'relationship', 'family_contribution', 'creativity')
     or schedule_timezone is distinct from 'Asia/Taipei'
     or schedule_weekdays is null
     or cardinality(schedule_weekdays) not between 1 and 7
     or not schedule_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
     or (schedule_duration_minutes is not null and schedule_duration_minutes not between 1 and 1440)
     or (coalesce(schedule_requires_timer, false) and schedule_duration_minutes is null)
     or (schedule_start_time is not null and schedule_end_time is not null and schedule_end_time <= schedule_start_time)
     or schedule_active_from is null
     or (schedule_active_until is not null and schedule_active_until < effective_active_from) then
    raise exception 'schedule update is invalid' using errcode = '22023';
  end if;
  if nullif(trim(schedule_description), '') is not null
     and char_length(trim(schedule_description)) > 2000 then
    raise exception 'schedule description is invalid' using errcode = '22023';
  end if;
  if char_length(coalesce(nullif(trim(schedule_icon), ''), 'Target')) not between 1 and 32 then
    raise exception 'schedule icon is invalid' using errcode = '22023';
  end if;

  -- A timer session means the child has already begun the occurrence. Do not
  -- change its duration or execution window underneath an active attempt.
  if exists (
    select 1
      from public.tasks task
      join public.adventure_timer_sessions timer on timer.task_id = task.id
     where task.schedule_id = current_row.id
       and task.occurrence_date >= scoped_from_date
       and (
         update_scope <> 'today_unfinished'
         or task.occurrence_date = taipei_today
       )
       and task.status = 'todo'
       and timer.status in ('running', 'paused')
  ) then
    raise exception 'an affected adventure has an active timer' using errcode = '55000';
  end if;

  -- A tomorrow-only edit forks the schedule. This freezes today's old rules and
  -- gives future lazy occurrence creation a new source of truth.
  if update_scope = 'from_tomorrow' then
    perform public.ensure_daily_adventure_occurrences(
      current_row.child_profile_id,
      taipei_today
    );

    delete from public.tasks task
     where task.schedule_id = current_row.id
       and task.adventure_type = 'daily'
       and task.status = 'todo'
       and task.occurrence_date >= scoped_from_date;

    update public.task_schedules
       set is_active = false
     where id = current_row.id;

    insert into public.task_schedules (
      family_id, child_profile_id, name, description, points, icon, category,
      duration_minutes, start_time, end_time, weekdays, timezone, requires_timer,
      requires_review_before_next_task, active_from, active_until, is_active
    ) values (
      current_row.family_id, current_row.child_profile_id, trim(schedule_name),
      nullif(trim(schedule_description), ''), schedule_points,
      coalesce(nullif(trim(schedule_icon), ''), 'Target'), schedule_category,
      schedule_duration_minutes, schedule_start_time, schedule_end_time,
      schedule_weekdays, schedule_timezone, coalesce(schedule_requires_timer, false),
      coalesce(schedule_requires_review_before_next_task, false),
      effective_active_from, schedule_active_until, true
    )
    returning * into updated_row;

  -- today_unfinished is an occurrence-only correction. today_and_future updates
  -- the active recurring source and only its untouched occurrences.
  elsif update_scope = 'today_and_future' then
    update public.task_schedules
       set name = trim(schedule_name),
           description = nullif(trim(schedule_description), ''),
           points = schedule_points,
           icon = coalesce(nullif(trim(schedule_icon), ''), 'Target'),
           category = schedule_category,
           duration_minutes = schedule_duration_minutes,
           start_time = schedule_start_time,
           end_time = schedule_end_time,
           weekdays = schedule_weekdays,
           timezone = schedule_timezone,
           requires_timer = coalesce(schedule_requires_timer, false),
           requires_review_before_next_task = coalesce(schedule_requires_review_before_next_task, false),
           active_from = effective_active_from,
           active_until = schedule_active_until
     where id = current_row.id
     returning * into updated_row;

    -- Only generated, untouched current/future occurrences may disappear when the new
    -- recurrence no longer includes their dates. Submitted and historical rows
    -- are immutable.
    delete from public.tasks task
     where task.schedule_id = current_row.id
       and task.adventure_type = 'daily'
       and task.status = 'todo'
       and task.occurrence_date >= scoped_from_date
       and (
         task.occurrence_date < schedule_active_from
         or (schedule_active_until is not null and task.occurrence_date > schedule_active_until)
         or not (extract(isodow from task.occurrence_date)::smallint = any(schedule_weekdays))
       );
  else
    updated_row := current_row;
  end if;

  if update_scope <> 'from_tomorrow' then
    update public.tasks task
     set name = trim(schedule_name),
         description = nullif(trim(schedule_description), ''),
         points = schedule_points,
         icon = coalesce(nullif(trim(schedule_icon), ''), 'Target'),
         category = schedule_category,
         duration_minutes = schedule_duration_minutes,
         due_time = schedule_start_time,
         end_time = schedule_end_time,
         requires_timer = coalesce(schedule_requires_timer, false),
         requires_review_before_next_task = coalesce(schedule_requires_review_before_next_task, false),
         execution_timezone = schedule_timezone
   where task.schedule_id = current_row.id
     and task.adventure_type = 'daily'
     and task.status = 'todo'
     and task.occurrence_date >= scoped_from_date
     and (
       update_scope <> 'today_unfinished'
       or task.occurrence_date = taipei_today
     );
  end if;

  return updated_row;
end;
$$;

create function public.disable_adventure_schedule(target_schedule_id uuid)
returns public.task_schedules
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  schedule_row public.task_schedules;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into schedule_row
    from public.task_schedules
   where id = target_schedule_id
   for update;
  if not found or not private.is_family_parent(schedule_row.family_id) then
    raise exception 'schedule not found or not authorized' using errcode = '42501';
  end if;
  update public.task_schedules
     set is_active = false
   where id = schedule_row.id
   returning * into schedule_row;
  return schedule_row;
end;
$$;

create function public.ensure_daily_adventure_occurrences(
  target_child_profile_id uuid,
  target_date date default (timezone('Asia/Taipei', now()))::date
)
returns setof public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  child_row public.child_profiles;
begin
  if (select auth.uid()) is null or target_date is null then
    raise exception 'authentication required and date is required' using errcode = '42501';
  end if;
  select * into child_row
    from public.child_profiles child
   where child.id = target_child_profile_id;
  if not found
     or not (
       private.is_child_owner(child_row.family_id, child_row.id)
       or private.is_family_parent(child_row.family_id)
     ) then
    raise exception 'child profile not found or not authorized' using errcode = '42501';
  end if;
  if private.is_child_owner(child_row.family_id, child_row.id)
     and not private.is_family_parent(child_row.family_id)
     and target_date <> (timezone('Asia/Taipei', now()))::date then
    raise exception 'children may only ensure today''s adventures' using errcode = '42501';
  end if;

  insert into public.tasks (
    family_id, child_profile_id, name, description, points, status, icon,
    duration_minutes, is_daily, due_on, due_time, end_time, category, origin,
    requires_review_before_next_task, adventure_type, schedule_id,
    occurrence_date, completion_report_mode, requires_timer, execution_timezone
  )
  select
    schedule.family_id,
    schedule.child_profile_id,
    schedule.name,
    schedule.description,
    schedule.points,
    'todo',
    schedule.icon,
    schedule.duration_minutes,
    true,
    target_date,
    schedule.start_time,
    schedule.end_time,
    schedule.category,
    'parent_assigned',
    schedule.requires_review_before_next_task,
    'daily',
    schedule.id,
    target_date,
    'none',
    schedule.requires_timer,
    schedule.timezone
  from public.task_schedules schedule
  where schedule.child_profile_id = child_row.id
    and schedule.family_id = child_row.family_id
    and schedule.is_active
    and target_date >= schedule.active_from
    and (schedule.active_until is null or target_date <= schedule.active_until)
    and extract(isodow from target_date)::smallint = any(schedule.weekdays)
  on conflict (schedule_id, child_profile_id, occurrence_date)
    where schedule_id is not null
    do nothing;

  return query
  select task.*
    from public.tasks task
   where task.child_profile_id = child_row.id
     and task.adventure_type = 'daily'
     and task.occurrence_date = target_date
   order by task.created_at, task.id;
end;
$$;

create function public.create_general_adventure(
  target_family_id uuid,
  target_child_profile_id uuid,
  adventure_name text,
  adventure_description text,
  adventure_points integer,
  adventure_icon text,
  adventure_category text,
  adventure_duration_minutes integer,
  adventure_due_on date,
  adventure_start_time time,
  adventure_end_time time,
  adventure_completion_report_mode text default 'quick',
  adventure_requires_timer boolean default false,
  adventure_requires_review_before_next_task boolean default false
)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  task_row public.tasks;
  group_row public.adventure_groups;
  normalized_name text := trim(adventure_name);
  normalized_description text := nullif(trim(adventure_description), '');
  normalized_icon text := coalesce(nullif(trim(adventure_icon), ''), 'Target');
begin
  if (select auth.uid()) is null
     or not private.is_family_parent(target_family_id) then
    raise exception 'general adventure not found or not authorized' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.child_profiles child
     where child.family_id = target_family_id
       and child.id = target_child_profile_id
  ) then
    raise exception 'child profile not found' using errcode = '22023';
  end if;
  if normalized_name is null or char_length(normalized_name) not between 1 and 120 then
    raise exception 'adventure name is invalid' using errcode = '22023';
  end if;
  if normalized_description is not null and char_length(normalized_description) > 2000 then
    raise exception 'adventure description is invalid' using errcode = '22023';
  end if;
  if adventure_points is null or adventure_points < 0 then
    raise exception 'adventure points must be nonnegative' using errcode = '22023';
  end if;
  if char_length(normalized_icon) not between 1 and 32 then
    raise exception 'adventure icon is invalid' using errcode = '22023';
  end if;
  if adventure_category not in ('life_habit', 'learning', 'health', 'relationship', 'family_contribution', 'creativity') then
    raise exception 'adventure category is invalid' using errcode = '22023';
  end if;
  if adventure_completion_report_mode not in ('quick', 'reflection') then
    raise exception 'general adventures require a report' using errcode = '22023';
  end if;
  if adventure_duration_minutes is not null
     and adventure_duration_minutes not between 1 and 1440 then
    raise exception 'adventure duration is invalid' using errcode = '22023';
  end if;
  if coalesce(adventure_requires_timer, false) and adventure_duration_minutes is null then
    raise exception 'timer adventures require a duration' using errcode = '22023';
  end if;
  if adventure_start_time is not null
     and adventure_end_time is not null
     and adventure_end_time <= adventure_start_time then
    raise exception 'adventure execution window is invalid' using errcode = '22023';
  end if;

  group_row := private.ensure_active_general_group(target_family_id, target_child_profile_id);

  insert into public.tasks (
    family_id, child_profile_id, name, description, points, status, icon,
    duration_minutes, is_daily, due_on, due_time, end_time, category, origin,
    requires_review_before_next_task, adventure_type, adventure_group_id,
    occurrence_date, completion_report_mode, requires_timer, execution_timezone
  ) values (
    target_family_id, target_child_profile_id, normalized_name,
    normalized_description, adventure_points, 'todo', normalized_icon,
    adventure_duration_minutes, false, adventure_due_on, adventure_start_time,
    adventure_end_time, adventure_category, 'parent_assigned',
    coalesce(adventure_requires_review_before_next_task, false), 'general',
    group_row.id, adventure_due_on, adventure_completion_report_mode,
    coalesce(adventure_requires_timer, false), 'Asia/Taipei'
  )
  returning * into task_row;
  return task_row;
end;
$$;

create function public.update_general_adventure_title(
  target_child_profile_id uuid,
  new_title text
)
returns public.adventure_groups
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  child_row public.child_profiles;
  group_row public.adventure_groups;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into child_row
    from public.child_profiles child
   where child.id = target_child_profile_id;
  if not found or not private.is_family_parent(child_row.family_id) then
    raise exception 'adventure group not found or not authorized' using errcode = '42501';
  end if;
  group_row := private.ensure_active_general_group(child_row.family_id, child_row.id);
  update public.adventure_groups
     set title = private.validate_adventure_group_title(new_title)
   where id = group_row.id
   returning * into group_row;
  return group_row;
end;
$$;

create function public.archive_adventure_group(target_group_id uuid)
returns public.adventure_groups
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  group_row public.adventure_groups;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into group_row
    from public.adventure_groups
   where id = target_group_id
   for update;
  if not found or not private.is_family_parent(group_row.family_id) then
    raise exception 'adventure group not found or not authorized' using errcode = '42501';
  end if;
  if group_row.status <> 'active' then
    return group_row;
  end if;
  if exists (
    select 1 from public.tasks task
     where task.adventure_group_id = group_row.id
       and task.status <> 'completed'
  ) then
    raise exception 'unfinished adventures must be moved or cancelled before archiving' using errcode = '22023';
  end if;
  update public.adventure_groups
     set status = 'archived',
         archived_at = timezone('utc', now())
   where id = group_row.id
   returning * into group_row;
  perform private.ensure_active_general_group(group_row.family_id, group_row.child_profile_id);
  return group_row;
end;
$$;

-- Replace the legacy permissive proposal flow. A child proposal is always a
-- general adventure and cannot be completed until a parent confirms it.
create or replace function public.propose_child_goal(
  target_family_id uuid,
  target_child_profile_id uuid,
  goal_name text,
  goal_points integer,
  goal_icon text,
  goal_category text,
  goal_duration_minutes integer default null,
  goal_due_on date default null,
  goal_due_time time default null,
  goal_end_time time default null
)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  task_row public.tasks;
  group_row public.adventure_groups;
  normalized_name text := trim(goal_name);
  normalized_icon text := coalesce(nullif(trim(goal_icon), ''), 'Target');
begin
  if (select auth.uid()) is null
     or not (
       private.is_child_owner(target_family_id, target_child_profile_id)
       or private.is_family_parent(target_family_id)
     ) then
    raise exception 'child goal not found or not authorized' using errcode = '42501';
  end if;
  if normalized_name is null or char_length(normalized_name) not between 1 and 120 then
    raise exception 'goal name is invalid' using errcode = '22023';
  end if;
  if goal_points is null or goal_points < 0 then
    raise exception 'goal points must be nonnegative' using errcode = '22023';
  end if;
  if char_length(normalized_icon) not between 1 and 32
     or goal_category not in ('life_habit', 'learning', 'health', 'relationship', 'family_contribution', 'creativity')
     or (goal_duration_minutes is not null and goal_duration_minutes not between 1 and 1440)
     or goal_due_time is null
     or goal_end_time is null
     or goal_end_time <= goal_due_time then
    raise exception 'goal details are invalid' using errcode = '22023';
  end if;
  group_row := private.ensure_active_general_group(target_family_id, target_child_profile_id);

  insert into public.tasks (
    family_id, child_profile_id, name, points, status, icon, duration_minutes,
    is_daily, due_on, due_time, end_time, category, origin, original_name,
    original_points, adventure_type, adventure_group_id, occurrence_date,
    completion_report_mode, requires_timer, execution_timezone
  ) values (
    target_family_id, target_child_profile_id, normalized_name, goal_points,
    'proposed', normalized_icon, goal_duration_minutes, false,
    coalesce(goal_due_on, (timezone('Asia/Taipei', now()))::date),
    goal_due_time, goal_end_time, goal_category, 'child_proposed',
    normalized_name, goal_points, 'general', group_row.id,
    coalesce(goal_due_on, (timezone('Asia/Taipei', now()))::date),
    'quick', false, 'Asia/Taipei'
  )
  returning * into task_row;
  return task_row;
end;
$$;

create function public.start_adventure_timer(target_task_id uuid)
returns public.adventure_timer_sessions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  task_row public.tasks;
  timer_row public.adventure_timer_sessions;
  started_time timestamptz := timezone('utc', now());
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into task_row from public.tasks where id = target_task_id for update;
  if not found
     or not (
       private.is_child_owner(task_row.family_id, task_row.child_profile_id)
       or private.is_family_parent(task_row.family_id)
     ) then
    raise exception 'task not found or not authorized' using errcode = '42501';
  end if;
  if not task_row.requires_timer then
    raise exception 'task does not require a timer' using errcode = '22023';
  end if;
  if task_row.status not in ('todo', 'revision_requested')
     or (task_row.origin = 'child_proposed' and task_row.confirmed_at is null) then
    raise exception 'task is not ready for timing' using errcode = '22023';
  end if;
  if not private.adventure_execution_is_open(task_row) then
    raise exception 'task execution window is closed' using errcode = '22023';
  end if;

  select * into timer_row
    from public.adventure_timer_sessions timer
   where timer.task_id = task_row.id
   for update;
  if found then
    if timer_row.status = 'running' then
      return timer_row;
    end if;
    if timer_row.status = 'completed' then
      return timer_row;
    end if;
    if exists (
      select 1 from public.adventure_timer_sessions other_timer
       where other_timer.child_profile_id = task_row.child_profile_id
         and other_timer.status = 'running'
         and other_timer.id <> timer_row.id
    ) then
      raise exception 'another timer is already running' using errcode = '23505';
    end if;
    update public.adventure_timer_sessions
       set status = 'running',
           last_resumed_at = started_time,
           paused_at = null
     where id = timer_row.id
     returning * into timer_row;
    return timer_row;
  end if;

  insert into public.adventure_timer_sessions (
    family_id, child_profile_id, task_id, status, accumulated_seconds,
    started_at, last_resumed_at
  ) values (
    task_row.family_id, task_row.child_profile_id, task_row.id, 'running', 0,
    started_time, started_time
  )
  returning * into timer_row;
  return timer_row;
end;
$$;

create function public.pause_adventure_timer(target_task_id uuid)
returns public.adventure_timer_sessions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  task_row public.tasks;
  timer_row public.adventure_timer_sessions;
  paused_time timestamptz := timezone('utc', now());
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into task_row from public.tasks where id = target_task_id;
  if not found
     or not (
       private.is_child_owner(task_row.family_id, task_row.child_profile_id)
       or private.is_family_parent(task_row.family_id)
     ) then
    raise exception 'task not found or not authorized' using errcode = '42501';
  end if;
  select * into timer_row
    from public.adventure_timer_sessions timer
   where timer.task_id = task_row.id
   for update;
  if not found then
    raise exception 'timer has not started' using errcode = '22023';
  end if;
  if timer_row.status <> 'running' then
    return timer_row;
  end if;

  update public.adventure_timer_sessions
     set status = 'paused',
         accumulated_seconds = accumulated_seconds
           + greatest(0, floor(extract(epoch from (paused_time - last_resumed_at)))::integer),
         last_resumed_at = null,
         paused_at = paused_time
   where id = timer_row.id
   returning * into timer_row;
  return timer_row;
end;
$$;

create function public.resume_adventure_timer(target_task_id uuid)
returns public.adventure_timer_sessions
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  task_row public.tasks;
  timer_row public.adventure_timer_sessions;
  resumed_time timestamptz := timezone('utc', now());
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into task_row from public.tasks where id = target_task_id for update;
  if not found
     or not (
       private.is_child_owner(task_row.family_id, task_row.child_profile_id)
       or private.is_family_parent(task_row.family_id)
     ) then
    raise exception 'task not found or not authorized' using errcode = '42501';
  end if;
  if task_row.status not in ('todo', 'revision_requested')
     or not task_row.requires_timer
     or not private.adventure_execution_is_open(task_row) then
    raise exception 'task is not ready for timing' using errcode = '22023';
  end if;
  select * into timer_row
    from public.adventure_timer_sessions timer
   where timer.task_id = task_row.id
   for update;
  if not found then
    raise exception 'timer has not started' using errcode = '22023';
  end if;
  if timer_row.status in ('running', 'completed') then
    return timer_row;
  end if;
  if exists (
    select 1 from public.adventure_timer_sessions other_timer
     where other_timer.child_profile_id = task_row.child_profile_id
       and other_timer.status = 'running'
       and other_timer.id <> timer_row.id
  ) then
    raise exception 'another timer is already running' using errcode = '23505';
  end if;
  update public.adventure_timer_sessions
     set status = 'running',
         last_resumed_at = resumed_time,
         paused_at = null
   where id = timer_row.id
   returning * into timer_row;
  return timer_row;
end;
$$;

create function public.submit_adventure_completion(
  target_task_id uuid,
  idempotency_key uuid,
  quick_report text default null,
  reflection text default null,
  mood text default null,
  difficulty smallint default null
)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  task_row public.tasks;
  timer_row public.adventure_timer_sessions;
  normalized_reflection text := nullif(trim(reflection), '');
  submitted_time timestamptz := timezone('utc', now());
  elapsed_seconds integer;
begin
  if (select auth.uid()) is null or idempotency_key is null then
    raise exception 'authentication and idempotency key are required' using errcode = '42501';
  end if;

  select task.* into task_row
    from private.adventure_completion_submissions submission
    join public.tasks task on task.id = submission.task_id
   where submission.task_id = target_task_id
     and submission.idempotency_key = submit_adventure_completion.idempotency_key
     and submission.submitted_by = (select auth.uid());
  if found then
    return task_row;
  end if;

  select * into task_row
    from public.tasks
   where id = target_task_id
   for update;
  if not found
     or not (
       private.is_child_owner(task_row.family_id, task_row.child_profile_id)
       or private.is_family_parent(task_row.family_id)
     ) then
    raise exception 'task not found or not authorized' using errcode = '42501';
  end if;
  if task_row.status not in ('todo', 'revision_requested') then
    raise exception 'task is not ready for submission' using errcode = '22023';
  end if;
  if task_row.origin = 'child_proposed' and task_row.confirmed_at is null then
    raise exception 'proposed adventures require parent confirmation' using errcode = '22023';
  end if;
  if not private.adventure_execution_is_open(task_row) then
    raise exception 'task execution window is closed' using errcode = '22023';
  end if;
  if exists (
    select 1
      from public.tasks blocking_task
     where blocking_task.child_profile_id = task_row.child_profile_id
       and blocking_task.id <> task_row.id
       and blocking_task.requires_review_before_next_task
       and blocking_task.status in ('pending', 'revision_requested')
  ) then
    raise exception 'another task is waiting for parent review' using errcode = '42501';
  end if;

  if task_row.adventure_type = 'daily' then
    if task_row.completion_report_mode <> 'none' then
      raise exception 'daily adventure report mode is invalid' using errcode = '23514';
    end if;
  elsif task_row.completion_report_mode = 'quick' then
    if quick_report is null or quick_report not in ('smooth', 'hard', 'help') then
      raise exception 'quick report is required' using errcode = '22023';
    end if;
  elsif task_row.completion_report_mode = 'reflection' then
    if normalized_reflection is null or char_length(normalized_reflection) > 2000 then
      raise exception 'reflection is required' using errcode = '22023';
    end if;
    if mood is null or mood not in ('proud', 'happy', 'calm', 'okay', 'tired', 'frustrated') then
      raise exception 'mood is invalid' using errcode = '22023';
    end if;
    if difficulty is null or difficulty not between 1 and 5 then
      raise exception 'difficulty is invalid' using errcode = '22023';
    end if;
  else
    raise exception 'general adventures require a report' using errcode = '23514';
  end if;

  if task_row.requires_timer then
    select * into timer_row
      from public.adventure_timer_sessions timer
     where timer.task_id = task_row.id
     for update;
    if not found then
      raise exception 'required timer has not started' using errcode = '22023';
    end if;
    elapsed_seconds := timer_row.accumulated_seconds
      + case
          when timer_row.status = 'running'
            then greatest(0, floor(extract(epoch from (submitted_time - timer_row.last_resumed_at)))::integer)
          else 0
        end;
    if elapsed_seconds < task_row.duration_minutes * 60 then
      raise exception 'required timer duration has not been reached' using errcode = '22023';
    end if;
    update public.adventure_timer_sessions
       set status = 'completed',
           accumulated_seconds = elapsed_seconds,
           last_resumed_at = null,
           paused_at = case when timer_row.status = 'paused' then timer_row.paused_at else submitted_time end,
           completed_at = submitted_time
     where id = timer_row.id;
  end if;

  insert into private.adventure_completion_submissions (
    task_id, idempotency_key, submitted_by
  ) values (
    task_row.id, idempotency_key, (select auth.uid())
  );

  update public.tasks
     set status = 'pending',
         submitted_at = submitted_time,
         completed_at = submitted_time,
         completion_idempotency_key = idempotency_key,
         quick_report = case
           when completion_report_mode = 'quick'
             then submit_adventure_completion.quick_report
           else null
         end,
         child_reflection_text = case when completion_report_mode = 'reflection' then normalized_reflection else null end,
         child_mood = case when completion_report_mode = 'reflection' then mood else null end,
         child_difficulty = case when completion_report_mode = 'reflection' then difficulty else null end,
         reviewed_at = null,
         reviewed_by = null,
         approved_points = null,
         parent_feedback_text = null,
         parent_correction_text = null,
         feedback_tone = null,
         revision_note = null
   where id = task_row.id
   returning * into task_row;
  return task_row;
end;
$$;

create function public.review_adventure_completion(
  target_task_id uuid,
  approved boolean,
  approved_points integer default null,
  feedback text default null,
  correction text default null,
  tone text default null,
  revision_note text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  task_row public.tasks;
  normalized_feedback text := nullif(trim(feedback), '');
  normalized_correction text := nullif(trim(correction), '');
  normalized_revision_note text := nullif(trim(revision_note), '');
  normalized_tone text := nullif(trim(tone), '');
  points_to_award integer;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if approved is null then
    raise exception 'review decision is required' using errcode = '22023';
  end if;
  if normalized_tone is not null
     and normalized_tone not in ('encouraging', 'coaching', 'corrective', 'celebratory') then
    raise exception 'feedback tone is invalid' using errcode = '22023';
  end if;

  select * into task_row from public.tasks where id = target_task_id for update;
  if not found or not private.is_family_parent(task_row.family_id) then
    raise exception 'task not found or not authorized' using errcode = '42501';
  end if;
  if task_row.status = 'completed' and approved then
    return task_row;
  end if;
  if task_row.status <> 'pending' then
    raise exception 'task is not pending review' using errcode = '22023';
  end if;

  if approved then
    points_to_award := coalesce(approved_points, task_row.points);
    if points_to_award < 0 then
      raise exception 'approved points must be nonnegative' using errcode = '22023';
    end if;
    if exists (select 1 from public.point_ledger ledger where ledger.task_id = task_row.id) then
      raise exception 'task already has a point ledger entry' using errcode = '23505';
    end if;

    if points_to_award > 0 then
      insert into public.point_ledger (
        family_id, child_profile_id, task_id, entry_type,
        points_delta, note
      ) values (
        task_row.family_id, task_row.child_profile_id, task_row.id,
        'task_approved', points_to_award,
        coalesce(normalized_feedback, 'task approved')
      );
      update public.child_profiles
         set points_balance = points_balance + points_to_award
       where id = task_row.child_profile_id
         and family_id = task_row.family_id;
    end if;

    update public.tasks
       set status = 'completed',
           reviewed_at = timezone('utc', now()),
           reviewed_by = (select auth.uid()),
           approved_points = points_to_award,
           parent_feedback_text = normalized_feedback,
           parent_correction_text = normalized_correction,
           feedback_tone = normalized_tone,
           revision_note = null
     where id = task_row.id
     returning * into task_row;
  else
    if normalized_revision_note is null or char_length(normalized_revision_note) > 1000 then
      raise exception 'revision note is required' using errcode = '22023';
    end if;
    update public.tasks
       set status = 'revision_requested',
           reviewed_at = timezone('utc', now()),
           reviewed_by = (select auth.uid()),
           approved_points = null,
           parent_feedback_text = normalized_feedback,
           parent_correction_text = normalized_correction,
           feedback_tone = normalized_tone,
           revision_note = normalized_revision_note
     where id = task_row.id
     returning * into task_row;
  end if;
  return task_row;
end;
$$;

create or replace function public.review_task_completion(
  target_task_id uuid,
  approved boolean,
  approved_points integer,
  feedback text,
  correction text,
  tone text,
  revision_note text
)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  return public.review_adventure_completion(
    target_task_id, approved, approved_points, feedback, correction, tone, revision_note
  );
end;
$$;

create function public.batch_review_daily_adventures(target_task_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  target_task_id uuid;
  reviewed_task public.tasks;
  results jsonb := '[]'::jsonb;
  failed_task_ids uuid[] := array[]::uuid[];
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if target_task_ids is null or cardinality(target_task_ids) = 0 then
    raise exception 'at least one task is required' using errcode = '22023';
  end if;

  foreach target_task_id in array target_task_ids loop
    begin
      if not exists (
        select 1 from public.tasks task
         where task.id = target_task_id
           and task.adventure_type = 'daily'
           and task.status = 'pending'
      ) then
        raise exception 'task is not a pending daily adventure' using errcode = '22023';
      end if;
      reviewed_task := public.review_adventure_completion(
        target_task_id, true, null, null, null, 'encouraging', null
      );
      results := results || jsonb_build_array(jsonb_build_object(
        'task_id', reviewed_task.id,
        'success', true,
        'status', reviewed_task.status
      ));
    exception when others then
      failed_task_ids := array_append(failed_task_ids, target_task_id);
      results := results || jsonb_build_array(jsonb_build_object(
        'task_id', target_task_id,
        'success', false,
        'error', sqlerrm
      ));
    end;
  end loop;
  return jsonb_build_object(
    'results', results,
    'failed_task_ids', to_jsonb(failed_task_ids)
  );
end;
$$;

create or replace function public.confirm_child_goal(
  target_task_id uuid,
  confirmed_name text,
  confirmed_points integer,
  confirmed_category text
)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  task_row public.tasks;
  normalized_name text := trim(confirmed_name);
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if normalized_name is null or char_length(normalized_name) not between 1 and 120
     or confirmed_points is null or confirmed_points < 0
     or confirmed_category not in ('life_habit', 'learning', 'health', 'relationship', 'family_contribution', 'creativity') then
    raise exception 'confirmed goal details are invalid' using errcode = '22023';
  end if;
  select * into task_row from public.tasks where id = target_task_id for update;
  if not found or not private.is_family_parent(task_row.family_id) then
    raise exception 'task not found or not authorized' using errcode = '42501';
  end if;
  if task_row.status not in ('proposed', 'proposal_revision_requested')
     or task_row.origin <> 'child_proposed'
     or task_row.adventure_type <> 'general' then
    raise exception 'task is not awaiting confirmation' using errcode = '22023';
  end if;
  update public.tasks
     set name = normalized_name,
         points = confirmed_points,
         category = confirmed_category,
         completion_report_mode = case
           when completion_report_mode = 'reflection' then 'reflection'
           else 'quick'
         end,
         status = 'todo',
         confirmed_at = timezone('utc', now()),
         confirmed_by = (select auth.uid()),
         reviewed_at = null,
         reviewed_by = null,
         revision_note = null
   where id = task_row.id
   returning * into task_row;
  return task_row;
end;
$$;

-- Compatibility endpoint: legacy reflection callers receive the same protected
-- validation and transaction as the adventure completion endpoint.
create or replace function public.submit_task_reflection(
  target_task_id uuid,
  reflection text,
  mood text,
  difficulty smallint
)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  task_row public.tasks;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select * into task_row from public.tasks where id = target_task_id;
  if not found
     or not (
       private.is_child_owner(task_row.family_id, task_row.child_profile_id)
       or private.is_family_parent(task_row.family_id)
     ) then
    raise exception 'task not found or not authorized' using errcode = '42501';
  end if;
  if task_row.completion_report_mode <> 'reflection' then
    raise exception 'use submit_adventure_completion for this report mode' using errcode = '22023';
  end if;
  return public.submit_adventure_completion(
    target_task_id, gen_random_uuid(), null, reflection, mood, difficulty
  );
end;
$$;

revoke all on function public.create_adventure_schedule(
  uuid, uuid, text, text, integer, text, text, integer, time, time,
  smallint[], text, boolean, boolean, date, date
) from public, anon;
grant execute on function public.create_adventure_schedule(
  uuid, uuid, text, text, integer, text, text, integer, time, time,
  smallint[], text, boolean, boolean, date, date
) to authenticated;

revoke all on function public.update_adventure_schedule(
  uuid, text, text, integer, text, text, integer, time, time,
  smallint[], text, boolean, boolean, date, date, text
) from public, anon;
grant execute on function public.update_adventure_schedule(
  uuid, text, text, integer, text, text, integer, time, time,
  smallint[], text, boolean, boolean, date, date, text
) to authenticated;

revoke all on function public.disable_adventure_schedule(uuid) from public, anon;
grant execute on function public.disable_adventure_schedule(uuid) to authenticated;
revoke all on function public.ensure_daily_adventure_occurrences(uuid, date) from public, anon;
grant execute on function public.ensure_daily_adventure_occurrences(uuid, date) to authenticated;

revoke all on function public.create_general_adventure(
  uuid, uuid, text, text, integer, text, text, integer, date, time, time,
  text, boolean, boolean
) from public, anon;
grant execute on function public.create_general_adventure(
  uuid, uuid, text, text, integer, text, text, integer, date, time, time,
  text, boolean, boolean
) to authenticated;

revoke all on function public.update_general_adventure_title(uuid, text) from public, anon;
grant execute on function public.update_general_adventure_title(uuid, text) to authenticated;
revoke all on function public.archive_adventure_group(uuid) from public, anon;
grant execute on function public.archive_adventure_group(uuid) to authenticated;

revoke all on function public.start_adventure_timer(uuid) from public, anon;
grant execute on function public.start_adventure_timer(uuid) to authenticated;
revoke all on function public.pause_adventure_timer(uuid) from public, anon;
grant execute on function public.pause_adventure_timer(uuid) to authenticated;
revoke all on function public.resume_adventure_timer(uuid) from public, anon;
grant execute on function public.resume_adventure_timer(uuid) to authenticated;

revoke all on function public.submit_adventure_completion(
  uuid, uuid, text, text, text, smallint
) from public, anon;
grant execute on function public.submit_adventure_completion(
  uuid, uuid, text, text, text, smallint
) to authenticated;

revoke all on function public.review_adventure_completion(
  uuid, boolean, integer, text, text, text, text
) from public, anon;
grant execute on function public.review_adventure_completion(
  uuid, boolean, integer, text, text, text, text
) to authenticated;
revoke all on function public.batch_review_daily_adventures(uuid[]) from public, anon;
grant execute on function public.batch_review_daily_adventures(uuid[]) to authenticated;

revoke all on function public.propose_child_goal(
  uuid, uuid, text, integer, text, text, integer, date, time, time
) from public, anon;
grant execute on function public.propose_child_goal(
  uuid, uuid, text, integer, text, text, integer, date, time, time
) to authenticated;
revoke all on function public.confirm_child_goal(uuid, text, integer, text) from public, anon;
grant execute on function public.confirm_child_goal(uuid, text, integer, text) to authenticated;
revoke all on function public.submit_task_reflection(uuid, text, text, smallint) from public, anon;
grant execute on function public.submit_task_reflection(uuid, text, text, smallint) to authenticated;
revoke all on function public.review_task_completion(
  uuid, boolean, integer, text, text, text, text
) from public, anon;
grant execute on function public.review_task_completion(
  uuid, boolean, integer, text, text, text, text
) to authenticated;
