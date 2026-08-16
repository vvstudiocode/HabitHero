-- Let furniture use the visible outer meadow while keeping character movement
-- inside the playable area. The client and server use the same 26.95-wide
-- outer grass plane, so its half-width is 13.475 units.

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
  visible_grass_boundary numeric := 13.475;
begin
  if target_position_x is null or target_position_y is null or target_position_z is null
     or target_scale is null
     or not (target_position_y between -2 and 5)
     or target_scale < greatest(0.1, target_min_scale)
     or target_scale > least(3, target_max_scale)
     or effective_radius <= 0 then
    raise exception 'world transform is outside the playable area' using errcode = '22023';
  end if;

  if target_entity_kind <> 'decoration'
     and (not (target_position_x between -5 and 5)
       or not (target_position_z between -5 and 5)
       or abs(target_position_x) + effective_radius > 4.8
       or abs(target_position_z) + effective_radius > 4.8) then
    raise exception 'world transform is outside the playable area' using errcode = '22023';
  end if;

  if target_entity_kind = 'decoration'
     and (not (target_position_x between -visible_grass_boundary and visible_grass_boundary)
       or not (target_position_z between -visible_grass_boundary and visible_grass_boundary)
       or abs(target_position_x) + effective_radius > visible_grass_boundary
       or abs(target_position_z) + effective_radius > visible_grass_boundary) then
    raise exception 'world transform is outside the visible meadow' using errcode = '22023';
  end if;

  if target_entity_kind = 'decoration'
     and (sqrt(power(target_position_x, 2) + power(target_position_z - 2.2, 2)) < effective_radius + 0.8 + 0.02
       or sqrt(power(target_position_x - 1.1, 2) + power(target_position_z + 8.9, 2)) < effective_radius + 2 + 0.02) then
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
