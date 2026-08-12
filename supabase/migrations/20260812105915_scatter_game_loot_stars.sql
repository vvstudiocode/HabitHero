-- Spread stars around a compact reward area using deterministic polar offsets.
-- The radius stays between 0.32 and 1.05 world units, so the reward feels
-- scattered without sending the child on a long search.

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
  star_center_x double precision := -2.2 + (mod(loot_seed, 5)::double precision * 0.12);
  star_center_z double precision := 1.55 + (mod(loot_seed / 5, 5)::double precision * 0.12);
  star_radius double precision;
  star_angle double precision;
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
      star_radius := 0.32 + (mod(loot_seed + star_index * 17, 74)::double precision / 100);
      star_angle := mod(loot_seed + star_index * 137, 360)::double precision * pi() / 180;
      insert into public.game_loot_drops (
        family_id, child_profile_id, source_task_id, drop_kind, drop_index, amount,
        position_x, position_y, position_z
      ) values (
        task_row.family_id, task_row.child_profile_id, task_row.id, 'star', star_index, 1,
        greatest(-4.2, least(4.2, star_center_x + cos(star_angle) * star_radius)),
        0.35,
        greatest(-4.2, least(4.2, star_center_z + sin(star_angle) * star_radius))
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

-- Reposition existing unclaimed stars using the same deterministic layout.
with scattered as (
  select drop.id,
         -2.2 + (mod(abs(hashtext(drop.source_task_id::text)::bigint), 5)::double precision * 0.12)
           + cos(mod(abs(hashtext(drop.source_task_id::text)::bigint) + drop.drop_index * 137, 360)::double precision * pi() / 180)
             * (0.32 + mod(abs(hashtext(drop.source_task_id::text)::bigint) + drop.drop_index * 17, 74)::double precision / 100) as next_x,
         1.55 + (mod(abs(hashtext(drop.source_task_id::text)::bigint) / 5, 5)::double precision * 0.12)
           + sin(mod(abs(hashtext(drop.source_task_id::text)::bigint) + drop.drop_index * 137, 360)::double precision * pi() / 180)
             * (0.32 + mod(abs(hashtext(drop.source_task_id::text)::bigint) + drop.drop_index * 17, 74)::double precision / 100) as next_z
    from public.game_loot_drops drop
   where drop.drop_kind = 'star'
     and drop.status = 'available'
)
update public.game_loot_drops drop
   set position_x = greatest(-4.2, least(4.2, scattered.next_x)),
       position_z = greatest(-4.2, least(4.2, scattered.next_z))
  from scattered
 where drop.id = scattered.id;

revoke all on function private.create_task_loot_drops(uuid, integer) from public, anon, authenticated;
