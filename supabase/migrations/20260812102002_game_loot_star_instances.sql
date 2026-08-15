-- A star reward is a collection of one-point pickups. Keep scrolls as one
-- drop, but give each star its own row so a five-point reward renders as five
-- visible stars and can be collected one at a time.

alter table public.game_loot_drops
  add column if not exists drop_index integer not null default 1;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
     where nsp.nspname = 'public'
       and rel.relname = 'game_loot_drops'
       and con.contype = 'u'
       and pg_get_constraintdef(con.oid) = 'UNIQUE (source_task_id, drop_kind)'
  loop
    execute format('alter table public.game_loot_drops drop constraint %I', constraint_name);
  end loop;
end;
$$;

do $$
begin
  if not exists (
    select 1
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
     where nsp.nspname = 'public'
       and rel.relname = 'game_loot_drops'
       and con.conname = 'game_loot_drops_drop_index_check'
  ) then
    alter table public.game_loot_drops
      add constraint game_loot_drops_drop_index_check check (drop_index > 0);
  end if;
end;
$$;

create unique index if not exists game_loot_drops_task_kind_index_unique
  on public.game_loot_drops (source_task_id, drop_kind, drop_index);

-- Split any currently available legacy multi-point star into individual
-- one-point rows. Claimed legacy rows are left intact because their points
-- have already been granted and must not be awarded again.
do $$
declare
  legacy_drop record;
  star_index integer;
  legacy_amount integer;
begin
  for legacy_drop in
    select *
      from public.game_loot_drops
     where drop_kind = 'star'
       and status = 'available'
       and amount > 1
     order by created_at, id
     for update
  loop
    legacy_amount := legacy_drop.amount::integer;
    update public.game_loot_drops
       set amount = 1, drop_index = 1
     where id = legacy_drop.id;

    for star_index in 2..legacy_amount loop
      insert into public.game_loot_drops (
        family_id, child_profile_id, source_task_id, drop_kind, drop_index, amount,
        position_x, position_y, position_z, status
      ) values (
        legacy_drop.family_id, legacy_drop.child_profile_id, legacy_drop.source_task_id,
        'star', star_index, 1,
        greatest(-4.5, least(4.5, legacy_drop.position_x + (mod(star_index - 1, 3) - 1) * 0.24)),
        legacy_drop.position_y,
        greatest(-4.5, least(4.5, legacy_drop.position_z + (floor((star_index - 1) / 3)::numeric - 0.25) * 0.24)),
        'available'
      ) on conflict (source_task_id, drop_kind, drop_index) do nothing;
    end loop;
  end loop;
end;
$$;

create or replace function private.create_task_loot_drops(
  target_task_id uuid,
  points_to_award integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  task_row public.tasks;
  loot_seed bigint := abs(hashtext(target_task_id::text)::bigint);
  star_index integer;
begin
  select * into task_row from public.tasks where id = target_task_id;
  if not found then
    raise exception 'task not found' using errcode = '22023';
  end if;
  if points_to_award is null or points_to_award < 0 then
    raise exception 'loot points are invalid' using errcode = '22023';
  end if;

  if points_to_award > 0 then
    for star_index in 1..points_to_award loop
      insert into public.game_loot_drops (
        family_id, child_profile_id, source_task_id, drop_kind, drop_index, amount,
        position_x, position_y, position_z
      ) values (
        task_row.family_id, task_row.child_profile_id, task_row.id, 'star', star_index, 1,
        -2.8 + (mod(loot_seed + star_index, 4) * 0.3)
          + (mod(star_index - 1, 3) - 1) * 0.18,
        0.35,
        1.15 + (mod((loot_seed / 4) + star_index, 4) * 0.35)
          + (floor((star_index - 1) / 3)::numeric - 0.5) * 0.18
      ) on conflict (source_task_id, drop_kind, drop_index) do nothing;
    end loop;

    update public.game_loot_drops
       set status = 'available', amount = 1, claim_id = null,
           claimed_at = null, claimed_by = null
     where source_task_id = task_row.id
       and drop_kind = 'star'
       and drop_index between 1 and points_to_award
       and status = 'cancelled'
       and claim_id is null;
  end if;

  insert into public.game_loot_drops (
    family_id, child_profile_id, source_task_id, drop_kind, drop_index, amount,
    position_x, position_y, position_z
  ) values (
    task_row.family_id, task_row.child_profile_id, task_row.id, 'scroll', 1, 1,
    -1.65 + (mod(loot_seed, 4) * 0.25), 0.22,
    1.65 + (mod(loot_seed / 4, 4) * 0.3)
  ) on conflict (source_task_id, drop_kind, drop_index) do nothing;
  update public.game_loot_drops
     set status = 'available', amount = 1, claim_id = null,
         claimed_at = null, claimed_by = null
   where source_task_id = task_row.id and drop_kind = 'scroll'
     and drop_index = 1 and status = 'cancelled' and claim_id is null;
end;
$$;

revoke all on function private.create_task_loot_drops(uuid, integer) from public, anon, authenticated;
