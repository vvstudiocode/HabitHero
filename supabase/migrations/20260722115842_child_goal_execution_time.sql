alter table public.tasks
  add column if not exists due_time time;

drop trigger if exists tasks_submission_guard on public.tasks;

create or replace function private.enforce_task_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    if new.origin = 'child_proposed' then
      if new.status <> 'todo'
         or new.confirmed_at is not null
         or new.confirmed_by is not null
         or new.submitted_at is not null
         or new.completed_at is not null
         or new.reviewed_at is not null
         or new.reviewed_by is not null
         or new.approved_points is not null
         or new.parent_feedback_text is not null
         or new.parent_correction_text is not null
         or new.feedback_tone is not null
         or new.revision_note is not null
         or new.due_time is null then
        raise exception 'child proposed goals must be ready to execute and await parent point confirmation' using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  if old.status = 'completed' then
    raise exception 'completed tasks cannot be changed' using errcode = '42501';
  end if;

  if private.is_child_owner(old.family_id, old.child_profile_id) and not private.is_family_parent(old.family_id) then
    if old.status not in ('todo', 'revision_requested')
       or new.id <> old.id
       or new.family_id <> old.family_id
       or new.child_profile_id <> old.child_profile_id
       or new.template_id is distinct from old.template_id
       or new.name <> old.name
       or new.points <> old.points
       or new.icon <> old.icon
       or new.duration_minutes is distinct from old.duration_minutes
       or new.is_daily <> old.is_daily
       or new.due_on is distinct from old.due_on
       or new.due_time is distinct from old.due_time
       or new.category is distinct from old.category
       or new.origin is distinct from old.origin
       or new.original_name is distinct from old.original_name
       or new.original_points is distinct from old.original_points
       or new.confirmed_at is distinct from old.confirmed_at
       or new.confirmed_by is distinct from old.confirmed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.reviewed_by is distinct from old.reviewed_by
       or new.approved_points is distinct from old.approved_points
       or new.parent_feedback_text is distinct from old.parent_feedback_text
       or new.parent_correction_text is distinct from old.parent_correction_text
       or new.feedback_tone is distinct from old.feedback_tone
       or new.revision_note is distinct from old.revision_note
       or new.status <> 'pending'
       or new.submitted_at is null
       or new.completed_at is null
       or new.child_reflection_text is null
       or char_length(trim(new.child_reflection_text)) not between 1 and 2000
       or new.child_difficulty is null
       or new.child_difficulty not between 1 and 5
       or (new.child_mood is not null and new.child_mood not in ('proud', 'happy', 'calm', 'okay', 'tired', 'frustrated')) then
      raise exception 'children may only submit their own task reflection' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_submission_guard
  before insert or update on public.tasks
  for each row execute function private.enforce_task_submission();

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert on public.tasks
  for insert to authenticated
  with check (
    private.is_family_parent(family_id)
    or (
      private.is_child_owner(family_id, child_profile_id)
      and status = 'todo'
      and origin = 'child_proposed'
      and confirmed_at is null
      and confirmed_by is null
      and submitted_at is null
      and completed_at is null
      and reviewed_at is null
      and reviewed_by is null
      and approved_points is null
      and parent_feedback_text is null
      and parent_correction_text is null
      and feedback_tone is null
      and revision_note is null
      and due_time is not null
    )
  );

drop policy if exists tasks_update_child on public.tasks;
create policy tasks_update_child on public.tasks
  for update to authenticated
  using (private.is_child_owner(family_id, child_profile_id) and status in ('todo', 'revision_requested'))
  with check (
    private.is_child_owner(family_id, child_profile_id)
    and status = 'pending'
    and submitted_at is not null
    and completed_at is not null
    and child_reflection_text is not null
    and char_length(trim(child_reflection_text)) between 1 and 2000
    and child_difficulty is not null
    and child_difficulty between 1 and 5
    and (child_mood is null or child_mood in ('proud', 'happy', 'calm', 'okay', 'tired', 'frustrated'))
  );

create or replace function public.propose_child_goal(
  target_family_id uuid,
  target_child_profile_id uuid,
  goal_name text,
  goal_points integer,
  goal_icon text,
  goal_category text,
  goal_duration_minutes integer default null,
  goal_due_on date default null,
  goal_due_time time default null
)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  task_row public.tasks;
  normalized_name text := trim(goal_name);
  normalized_icon text := coalesce(nullif(trim(goal_icon), ''), 'Target');
begin
  if (select auth.uid()) is null
     or not private.is_child_owner(target_family_id, target_child_profile_id) then
    raise exception 'child goal not found or not authorized' using errcode = '42501';
  end if;
  if normalized_name is null or char_length(normalized_name) not between 1 and 120 then
    raise exception 'goal name is invalid' using errcode = '22023';
  end if;
  if goal_points is null or goal_points <= 0 then
    raise exception 'goal points must be positive' using errcode = '22023';
  end if;
  if char_length(normalized_icon) not between 1 and 32 then
    raise exception 'goal icon is invalid' using errcode = '22023';
  end if;
  if goal_duration_minutes is not null and goal_duration_minutes not between 1 and 1440 then
    raise exception 'goal duration is invalid' using errcode = '22023';
  end if;
  if goal_due_time is null then
    raise exception 'goal due time is required' using errcode = '22023';
  end if;

  insert into public.tasks (
    family_id,
    child_profile_id,
    name,
    points,
    status,
    icon,
    duration_minutes,
    due_on,
    due_time,
    category,
    origin,
    original_name,
    original_points
  )
  values (
    target_family_id,
    target_child_profile_id,
    normalized_name,
    goal_points,
    'todo',
    normalized_icon,
    goal_duration_minutes,
    coalesce(goal_due_on, current_date),
    goal_due_time,
    private.validate_task_category(goal_category),
    'child_proposed',
    normalized_name,
    goal_points
  )
  returning * into task_row;

  return task_row;
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
  if normalized_name is null or char_length(normalized_name) not between 1 and 120 then
    raise exception 'confirmed goal name is invalid' using errcode = '22023';
  end if;
  if confirmed_points is null or confirmed_points <= 0 then
    raise exception 'confirmed points must be positive' using errcode = '22023';
  end if;

  select * into task_row
    from public.tasks
   where id = target_task_id
   for update;
  if not found or not private.is_family_parent(task_row.family_id) then
    raise exception 'task not found or not authorized' using errcode = '42501';
  end if;
  if task_row.status not in ('proposed', 'proposal_revision_requested', 'todo') or task_row.confirmed_at is not null then
    raise exception 'task is not awaiting confirmation' using errcode = '22023';
  end if;

  update public.tasks
     set name = normalized_name,
         points = confirmed_points,
         category = private.validate_task_category(confirmed_category),
         status = 'todo',
         original_name = coalesce(original_name, task_row.name),
         original_points = coalesce(original_points, task_row.points),
         confirmed_at = timezone('utc', now()),
         confirmed_by = (select auth.uid()),
         submitted_at = null,
         completed_at = null,
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

create or replace function public.return_child_goal(
  target_task_id uuid,
  target_revision_note text
)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  task_row public.tasks;
  normalized_note text := trim(target_revision_note);
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if normalized_note is null or char_length(normalized_note) not between 1 and 1000 then
    raise exception 'revision note is invalid' using errcode = '22023';
  end if;

  select * into task_row
    from public.tasks
   where id = target_task_id
   for update;
  if not found or not private.is_family_parent(task_row.family_id) then
    raise exception 'task not found or not authorized' using errcode = '42501';
  end if;
  if task_row.status not in ('proposed', 'proposal_revision_requested', 'todo') or task_row.confirmed_at is not null then
    raise exception 'task is not proposed' using errcode = '22023';
  end if;

  update public.tasks
     set status = 'proposal_revision_requested',
         reviewed_at = timezone('utc', now()),
         reviewed_by = (select auth.uid()),
         revision_note = normalized_note
   where id = task_row.id
   returning * into task_row;

  return task_row;
end;
$$;

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
  normalized_reflection text := trim(reflection);
  submitted_time timestamptz := timezone('utc', now());
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if normalized_reflection is null or char_length(normalized_reflection) not between 1 and 2000 then
    raise exception 'reflection is invalid' using errcode = '22023';
  end if;
  if mood is not null and mood not in ('proud', 'happy', 'calm', 'okay', 'tired', 'frustrated') then
    raise exception 'mood is invalid' using errcode = '22023';
  end if;
  if difficulty is null or difficulty not between 1 and 5 then
    raise exception 'difficulty is invalid' using errcode = '22023';
  end if;

  select * into task_row
    from public.tasks
   where id = target_task_id
   for update;
  if not found or not private.is_child_owner(task_row.family_id, task_row.child_profile_id) then
    raise exception 'task not found or not authorized' using errcode = '42501';
  end if;
  if task_row.status not in ('todo', 'revision_requested') then
    raise exception 'task is not ready for child submission' using errcode = '22023';
  end if;

  update public.tasks
     set status = 'pending',
         submitted_at = submitted_time,
         completed_at = submitted_time,
         child_reflection_text = normalized_reflection,
         child_mood = mood,
         child_difficulty = difficulty
   where id = task_row.id
   returning * into task_row;

  return task_row;
end;
$$;

revoke all on function public.propose_child_goal(uuid, uuid, text, integer, text, text, integer, date, time) from public, anon;
grant execute on function public.propose_child_goal(uuid, uuid, text, integer, text, text, integer, date, time) to authenticated;
revoke all on function public.confirm_child_goal(uuid, text, integer, text) from public, anon;
grant execute on function public.confirm_child_goal(uuid, text, integer, text) to authenticated;
revoke all on function public.return_child_goal(uuid, text) from public, anon;
grant execute on function public.return_child_goal(uuid, text) to authenticated;
revoke all on function public.submit_task_reflection(uuid, text, text, smallint) from public, anon;
grant execute on function public.submit_task_reflection(uuid, text, text, smallint) to authenticated;
