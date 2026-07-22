create or replace function private.is_task_execution_time_reached(target_due_time time)
returns boolean
language sql
stable
set search_path = pg_catalog
as $$
  select target_due_time is null
      or (timezone('Asia/Taipei', now()))::time >= target_due_time;
$$;

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

    if not private.is_task_execution_time_reached(old.due_time) then
      raise exception 'task execution time has not started' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create trigger tasks_submission_guard
  before insert or update on public.tasks
  for each row execute function private.enforce_task_submission();

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
  if not private.is_task_execution_time_reached(task_row.due_time) then
    raise exception 'task execution time has not started' using errcode = '22023';
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

revoke all on function private.is_task_execution_time_reached(time) from public, anon, authenticated;
revoke all on function public.submit_task_reflection(uuid, text, text, smallint) from public, anon;
grant execute on function public.submit_task_reflection(uuid, text, text, smallint) to authenticated;
