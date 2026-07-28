-- Optional per-task gate: after a child submits this task, other tasks for
-- the same child remain locked until the parent approves it. A revision
-- request intentionally keeps the gate closed while allowing the child to
-- resubmit the gated task itself.

alter table public.task_templates
  add column if not exists requires_review_before_next_task boolean not null default false;

alter table public.tasks
  add column if not exists requires_review_before_next_task boolean not null default false;

create or replace function private.enforce_task_review_gate()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    if private.is_child_owner(new.family_id, new.child_profile_id)
       and new.requires_review_before_next_task then
      raise exception 'children may not set task review gates' using errcode = '42501';
    end if;
    return new;
  end if;

  if not private.is_family_parent(old.family_id)
     and private.is_child_owner(old.family_id, old.child_profile_id) then
    if old.requires_review_before_next_task is distinct from new.requires_review_before_next_task then
      raise exception 'children may not change task review gates' using errcode = '42501';
    end if;

    if new.status = 'pending'
       and exists (
         select 1
           from public.tasks blocking_task
          where blocking_task.child_profile_id = old.child_profile_id
            and blocking_task.id <> old.id
            and blocking_task.requires_review_before_next_task
            and blocking_task.status in ('pending', 'revision_requested')
       ) then
      raise exception 'another task is waiting for parent review' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_review_gate_guard on public.tasks;
create trigger tasks_review_gate_guard
  before insert or update on public.tasks
  for each row execute function private.enforce_task_review_gate();

revoke all on function private.enforce_task_review_gate() from public, anon, authenticated;
