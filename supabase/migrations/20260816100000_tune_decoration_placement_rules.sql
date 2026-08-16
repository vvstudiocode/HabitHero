-- Make furniture easier to place at small scale and keep its collision proxy
-- close to the visible footprint. The client uses the same values for the
-- placement grid and the server remains the authority for final validation.

alter table public.game_catalog_items
  drop constraint if exists game_catalog_items_min_scale_check;
alter table public.game_catalog_items
  add constraint game_catalog_items_min_scale_check check (min_scale between 0.1 and 3);

alter table public.child_world_entities
  drop constraint if exists child_world_entities_scale_check;
alter table public.child_world_entities
  add constraint child_world_entities_scale_check check (scale between 0.1 and 3);

update public.game_catalog_items
set
  collision_radius = case asset_key
    when 'decoration.study-desk' then 0.740
    when 'decoration.bookcase' then 0.660
    when 'decoration.study-chair' then 0.500
    else collision_radius
  end,
  min_scale = 0.1,
  updated_at = timezone('utc', now())
where item_type = 'decoration'
  and asset_key in ('decoration.study-desk', 'decoration.bookcase', 'decoration.study-chair')
  and is_active;

create or replace function private.validate_world_transform(
  target_child_profile_id uuid,
  target_entity_id uuid,
  target_entity_kind text,
  target_position_x numeric,
  target_position_y numeric,
  target_position_z numeric,
  target_scale numeric,
  target_collision_radius numeric,
  target_min_scale numeric,
  target_max_scale numeric
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  effective_radius numeric := target_collision_radius * target_scale;
begin
  if target_position_x is null or target_position_y is null or target_position_z is null
     or target_scale is null
     or not (target_position_x between -5 and 5)
     or not (target_position_y between -2 and 5)
     or not (target_position_z between -5 and 5)
     or target_scale < greatest(0.1, target_min_scale)
     or target_scale > least(3, target_max_scale)
     or effective_radius <= 0
     or abs(target_position_x) + effective_radius > 4.8
     or abs(target_position_z) + effective_radius > 4.8 then
    raise exception 'world transform is outside the playable area' using errcode = '22023';
  end if;
  if target_entity_kind = 'decoration'
     and (sqrt(power(target_position_x, 2) + power(target_position_z - 2.2, 2)) < effective_radius + 0.8 + 0.02
       or sqrt(power(target_position_x, 2) + power(target_position_z, 2)) < effective_radius + 1.15 + 0.02) then
    raise exception 'world transform is inside a protected area' using errcode = '22023';
  end if;
  if target_entity_kind = 'decoration' and exists (
    select 1
      from public.child_world_entities entity
      join public.child_inventory_items inventory on inventory.id = entity.inventory_item_id
      join public.game_catalog_items item on item.id = inventory.catalog_item_id
     where entity.child_profile_id = target_child_profile_id
       and entity.is_active
       and entity.entity_kind = 'decoration'
       and entity.id is distinct from target_entity_id
       and sqrt(power(entity.position_x - target_position_x, 2) + power(entity.position_z - target_position_z, 2))
           < (item.collision_radius * entity.scale) + effective_radius + 0.02
  ) then
    raise exception 'decorations cannot overlap' using errcode = '23P01';
  end if;
end;
$$;

revoke all on function private.validate_world_transform(
  uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric
) from public, anon, authenticated;
