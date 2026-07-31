-- General adventure collections are lifecycle containers. Once every task in a
-- collection is approved, archive the container while keeping all task history.
create or replace function private.auto_archive_completed_general_adventure_group()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.adventure_type = 'general'
     and new.status = 'completed'
     and new.adventure_group_id is not null
     and exists (
       select 1
         from public.adventure_groups group_row
        where group_row.id = new.adventure_group_id
          and group_row.type = 'general'
          and group_row.status = 'active'
     )
     and not exists (
       select 1
         from public.tasks task
        where task.adventure_group_id = new.adventure_group_id
          and task.status <> 'completed'
     ) then
    update public.adventure_groups
       set status = 'archived',
           archived_at = timezone('utc', now())
     where id = new.adventure_group_id
       and status = 'active';
  end if;
  return new;
end;
$$;

drop trigger if exists auto_archive_completed_general_adventure_group on public.tasks;
create trigger auto_archive_completed_general_adventure_group
after update of status on public.tasks
for each row
execute function private.auto_archive_completed_general_adventure_group();
