-- Child-led growth workflow: proposed goals, parent confirmation, child
-- reflection, parent review, and transaction-safe point awards.

alter table public.task_templates
  add column if not exists category text not null default 'life_habit',
  add column if not exists suggested_evidence text not null default 'reflection';

alter table public.task_templates
  drop constraint if exists task_templates_category_check,
  drop constraint if exists task_templates_suggested_evidence_check;

alter table public.task_templates
  add constraint task_templates_category_check
  check (category in ('life_habit', 'learning', 'health', 'relationship', 'family_contribution', 'creativity')),
  add constraint task_templates_suggested_evidence_check
  check (suggested_evidence in ('reflection', 'checklist', 'parent_observation'));

alter table public.tasks
  add column if not exists category text not null default 'life_habit',
  add column if not exists origin text not null default 'parent_assigned',
  add column if not exists original_name text,
  add column if not exists original_points integer,
  add column if not exists confirmed_at timestamptz,
  add column if not exists confirmed_by uuid references public.profiles(id),
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id),
  add column if not exists approved_points integer,
  add column if not exists child_reflection_text text,
  add column if not exists child_mood text,
  add column if not exists child_difficulty smallint,
  add column if not exists parent_feedback_text text,
  add column if not exists parent_correction_text text,
  add column if not exists feedback_tone text,
  add column if not exists revision_note text;

update public.tasks
   set submitted_at = coalesce(submitted_at, completed_at)
 where status in ('pending', 'completed')
   and completed_at is not null;

update public.tasks
   set reviewed_at = coalesce(reviewed_at, completed_at),
       approved_points = coalesce(approved_points, points)
 where status = 'completed'
   and completed_at is not null;

alter table public.tasks
  drop constraint if exists tasks_status_check,
  drop constraint if exists tasks_check,
  drop constraint if exists tasks_category_check,
  drop constraint if exists tasks_origin_check,
  drop constraint if exists tasks_original_points_check,
  drop constraint if exists tasks_approved_points_check,
  drop constraint if exists tasks_child_difficulty_check,
  drop constraint if exists tasks_child_mood_check,
  drop constraint if exists tasks_feedback_tone_check,
  drop constraint if exists tasks_growth_status_timing_check;

alter table public.tasks
  add constraint tasks_status_check
  check (status in ('proposed', 'proposal_revision_requested', 'todo', 'pending', 'revision_requested', 'completed')),
  add constraint tasks_category_check
  check (category in ('life_habit', 'learning', 'health', 'relationship', 'family_contribution', 'creativity')),
  add constraint tasks_origin_check
  check (origin in ('child_proposed', 'parent_suggested', 'parent_assigned', 'system_template')),
  add constraint tasks_original_points_check
  check (original_points is null or original_points > 0),
  add constraint tasks_approved_points_check
  check (approved_points is null or approved_points >= 0),
  add constraint tasks_child_difficulty_check
  check (child_difficulty is null or child_difficulty between 1 and 5),
  add constraint tasks_child_mood_check
  check (child_mood is null or child_mood in ('proud', 'happy', 'calm', 'okay', 'tired', 'frustrated')),
  add constraint tasks_feedback_tone_check
  check (feedback_tone is null or feedback_tone in ('encouraging', 'coaching', 'corrective', 'celebratory')),
  add constraint tasks_growth_status_timing_check
  check (
    (status in ('proposed', 'todo') and completed_at is null and submitted_at is null and reviewed_at is null)
    or (status = 'proposal_revision_requested' and completed_at is null and submitted_at is null and reviewed_at is not null and revision_note is not null)
    or (status = 'pending' and submitted_at is not null)
    or (status = 'revision_requested' and reviewed_at is not null and revision_note is not null)
    or (status = 'completed' and completed_at is not null and submitted_at is not null and reviewed_at is not null)
  );

create or replace function private.enforce_task_submission()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    if private.is_family_parent(new.family_id) then
      return new;
    end if;

    if private.is_child_owner(new.family_id, new.child_profile_id) then
      if new.status <> 'proposed'
         or new.origin <> 'child_proposed'
         or new.points <= 0
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
         or new.revision_note is not null then
        raise exception 'children may only propose their own goal' using errcode = '42501';
      end if;

      new.original_name := coalesce(new.original_name, new.name);
      new.original_points := coalesce(new.original_points, new.points);
      return new;
    end if;

    raise exception 'task insert is not authorized' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE'
     and not private.is_family_parent(old.family_id)
     and private.is_child_owner(old.family_id, old.child_profile_id) then
    if old.family_id <> new.family_id
       or old.child_profile_id <> new.child_profile_id
       or old.name <> new.name
       or old.points <> new.points
       or old.icon <> new.icon
       or old.duration_minutes is distinct from new.duration_minutes
       or old.is_daily <> new.is_daily
       or old.due_on is distinct from new.due_on
       or old.template_id is distinct from new.template_id
       or old.category <> new.category
       or old.origin <> new.origin
       or old.original_name is distinct from new.original_name
       or old.original_points is distinct from new.original_points
       or old.confirmed_at is distinct from new.confirmed_at
       or old.confirmed_by is distinct from new.confirmed_by
       or old.reviewed_at is distinct from new.reviewed_at
       or old.reviewed_by is distinct from new.reviewed_by
       or old.approved_points is distinct from new.approved_points
       or old.parent_feedback_text is distinct from new.parent_feedback_text
       or old.parent_correction_text is distinct from new.parent_correction_text
       or old.feedback_tone is distinct from new.feedback_tone
       or old.revision_note is distinct from new.revision_note
       or old.status not in ('todo', 'revision_requested')
       or old.confirmed_at is null
       or new.status <> 'pending'
       or new.submitted_at is null
       or new.completed_at is null
       or new.child_reflection_text is null
       or char_length(trim(new.child_reflection_text)) not between 1 and 2000
       or new.child_difficulty is null
       or new.child_difficulty not between 1 and 5
       or (new.child_mood is not null and new.child_mood not in ('proud', 'happy', 'calm', 'okay', 'tired', 'frustrated')) then
      raise exception 'children may only submit their own confirmed task reflection' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_submission_guard on public.tasks;
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
      and status = 'proposed'
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
    )
  );

drop policy if exists tasks_update_child on public.tasks;
create policy tasks_update_child on public.tasks
  for update to authenticated
  using (private.is_child_owner(family_id, child_profile_id) and status in ('todo', 'revision_requested') and confirmed_at is not null)
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

create or replace function private.validate_task_category(target_category text)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if target_category not in ('life_habit', 'learning', 'health', 'relationship', 'family_contribution', 'creativity') then
    raise exception 'task category is invalid' using errcode = '22023';
  end if;
  return target_category;
end;
$$;

create or replace function public.propose_child_goal(
  target_family_id uuid,
  target_child_profile_id uuid,
  goal_name text,
  goal_points integer,
  goal_icon text,
  goal_category text,
  goal_duration_minutes integer default null,
  goal_due_on date default null
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

  insert into public.tasks (
    family_id,
    child_profile_id,
    name,
    points,
    status,
    icon,
    duration_minutes,
    due_on,
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
    'proposed',
    normalized_icon,
    goal_duration_minutes,
    goal_due_on,
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
  if task_row.status not in ('proposed', 'proposal_revision_requested') then
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
  if task_row.status not in ('proposed', 'proposal_revision_requested') then
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
  if task_row.status not in ('todo', 'revision_requested') or task_row.confirmed_at is null then
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
  if normalized_tone is not null and normalized_tone not in ('encouraging', 'coaching', 'corrective', 'celebratory') then
    raise exception 'feedback tone is invalid' using errcode = '22023';
  end if;

  select * into task_row
    from public.tasks
   where id = target_task_id
   for update;
  if not found or not private.is_family_parent(task_row.family_id) then
    raise exception 'task not found or not authorized' using errcode = '42501';
  end if;
  if task_row.status <> 'pending' then
    raise exception 'task is not pending review' using errcode = '22023';
  end if;

  if approved then
    points_to_award := coalesce(approved_points, task_row.points);
    if points_to_award <= 0 then
      raise exception 'approved points must be positive' using errcode = '22023';
    end if;
    if exists (select 1 from public.point_ledger where task_id = task_row.id) then
      raise exception 'task already approved' using errcode = '23505';
    end if;

    insert into public.point_ledger (family_id, child_profile_id, task_id, entry_type, points_delta, note)
    values (
      task_row.family_id,
      task_row.child_profile_id,
      task_row.id,
      'task_approved',
      points_to_award,
      coalesce(normalized_feedback, 'task approved')
    );

    update public.child_profiles
       set points_balance = points_balance + points_to_award
     where id = task_row.child_profile_id
       and family_id = task_row.family_id;

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
    if normalized_revision_note is null then
      raise exception 'revision note is required when requesting revision' using errcode = '22023';
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

create or replace function public.approve_task_completion(target_task_id uuid)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  task_row public.tasks;
begin
  select * into task_row
    from public.tasks
   where id = target_task_id;
  if not found then
    raise exception 'task not found or not authorized' using errcode = '42501';
  end if;

  return public.review_task_completion(
    target_task_id,
    true,
    task_row.points,
    'task approved',
    null,
    'encouraging',
    null
  );
end;
$$;

revoke all on function public.propose_child_goal(uuid, uuid, text, integer, text, text, integer, date) from public, anon;
grant execute on function public.propose_child_goal(uuid, uuid, text, integer, text, text, integer, date) to authenticated;
revoke all on function public.confirm_child_goal(uuid, text, integer, text) from public, anon;
grant execute on function public.confirm_child_goal(uuid, text, integer, text) to authenticated;
revoke all on function public.return_child_goal(uuid, text) from public, anon;
grant execute on function public.return_child_goal(uuid, text) to authenticated;
revoke all on function public.submit_task_reflection(uuid, text, text, smallint) from public, anon;
grant execute on function public.submit_task_reflection(uuid, text, text, smallint) to authenticated;
revoke all on function public.review_task_completion(uuid, boolean, integer, text, text, text, text) from public, anon;
grant execute on function public.review_task_completion(uuid, boolean, integer, text, text, text, text) to authenticated;
revoke all on function public.approve_task_completion(uuid) from public, anon;
grant execute on function public.approve_task_completion(uuid) to authenticated;
revoke all on function private.validate_task_category(text) from public, anon, authenticated;
