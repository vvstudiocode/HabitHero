create or replace function public.place_world_entity(
  target_inventory_item_id uuid,
  expected_revision bigint,
  position_x numeric,
  position_y numeric,
  position_z numeric,
  rotation_x numeric,
  rotation_y numeric,
  rotation_z numeric,
  target_scale numeric,
  target_behavior_mode text default 'static',
  target_roaming_slot smallint default null,
  target_child_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  child_row public.child_profiles;
  inventory_row public.child_inventory_items;
  catalog_row public.game_catalog_items;
  loadout_row public.child_game_loadouts;
  world_state public.child_world_states;
  entity_row public.child_world_entities;
  v_entity_kind text;
  following_ids uuid[];
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  insert into public.child_world_states (family_id, child_profile_id)
  values (child_row.family_id, child_row.id)
  on conflict do nothing;
  select * into world_state
    from public.child_world_states
   where child_profile_id = child_row.id
   for update;
  if expected_revision is null or expected_revision <> world_state.revision then
    raise exception 'world revision conflict' using errcode = '40001';
  end if;

  select inventory.* into inventory_row
    from public.child_inventory_items inventory
   where inventory.id = target_inventory_item_id
     and inventory.child_profile_id = child_row.id;
  if not found then
    raise exception 'world inventory item not found' using errcode = '42501';
  end if;
  select item.* into catalog_row
    from public.game_catalog_items item
   where item.id = inventory_row.catalog_item_id;
  if catalog_row.item_type = 'character' then
    raise exception 'characters cannot be placed as world entities' using errcode = '22023';
  end if;

  v_entity_kind := case when catalog_row.item_type = 'pet' then 'pet' else 'decoration' end;
  if target_behavior_mode not in ('static', 'idle', 'wander')
     or (v_entity_kind = 'decoration' and target_behavior_mode <> 'static')
     or (target_behavior_mode = 'wander' and (target_roaming_slot is null or target_roaming_slot < 1))
     or (target_behavior_mode <> 'wander' and target_roaming_slot is not null) then
    raise exception 'world entity behavior is invalid' using errcode = '22023';
  end if;

  select * into loadout_row
    from public.child_game_loadouts
   where child_profile_id = child_row.id;
  following_ids := coalesce(loadout_row.following_pet_inventory_ids, '{}'::uuid[]);
  if cardinality(following_ids) = 0 and loadout_row.following_pet_inventory_id is not null then
    following_ids := array[loadout_row.following_pet_inventory_id];
  end if;
  if v_entity_kind = 'pet' and following_ids && array[target_inventory_item_id] then
    raise exception 'following pet cannot be placed as a roaming pet' using errcode = '23514';
  end if;

  if v_entity_kind = 'decoration' then
    if (select count(*)
          from public.child_world_entities as world_entity
         where world_entity.child_profile_id = child_row.id
           and world_entity.inventory_item_id = target_inventory_item_id
           and world_entity.entity_kind = 'decoration'
           and world_entity.is_active) >= inventory_row.quantity then
      raise exception 'all owned copies of this decoration are already placed' using errcode = '23505';
    end if;
  elsif exists (
    select 1
      from public.child_world_entities as world_entity
     where world_entity.child_profile_id = child_row.id
       and world_entity.inventory_item_id = target_inventory_item_id
       and world_entity.is_active
  ) then
    raise exception 'world entity is already placed' using errcode = '23505';
  end if;

  if target_behavior_mode = 'wander' and exists (
    select 1
      from public.child_world_entities as world_entity
     where world_entity.child_profile_id = child_row.id
       and world_entity.entity_kind = 'pet'
       and world_entity.behavior_mode = 'wander'
       and world_entity.is_active
       and world_entity.roaming_slot = target_roaming_slot
  ) then
    raise exception 'roaming slot is already in use' using errcode = '23505';
  end if;

  perform private.validate_world_transform(
    child_row.id,
    null,
    v_entity_kind,
    position_x,
    position_y,
    position_z,
    target_scale,
    catalog_row.collision_radius,
    catalog_row.min_scale,
    catalog_row.max_scale
  );
  insert into public.child_world_entities (
    family_id, child_profile_id, inventory_item_id, entity_kind,
    position_x, position_y, position_z,
    rotation_x, rotation_y, rotation_z, scale,
    behavior_mode, roaming_slot, is_active
  ) values (
    child_row.family_id, child_row.id, target_inventory_item_id, v_entity_kind,
    position_x, position_y, position_z,
    rotation_x, rotation_y, rotation_z, target_scale,
    target_behavior_mode, target_roaming_slot, true
  ) returning * into entity_row;
  update public.child_world_states
     set revision = revision + 1
   where child_profile_id = child_row.id
   returning * into world_state;
  return jsonb_build_object('revision', world_state.revision, 'entity', to_jsonb(entity_row));
end;
$$;

create or replace function public.collect_all_world_decorations(
  expected_revision bigint,
  target_child_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  child_row public.child_profiles;
  world_state public.child_world_states;
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  select * into world_state
    from public.child_world_states
   where child_profile_id = child_row.id
   for update;
  if not found or expected_revision is null or expected_revision <> world_state.revision then
    raise exception 'world revision conflict' using errcode = '40001';
  end if;
  update public.child_world_entities as world_entity
     set is_active = false
   where world_entity.child_profile_id = child_row.id
     and world_entity.entity_kind = 'decoration'
     and world_entity.is_active;
  update public.child_world_states
     set revision = revision + 1
   where child_profile_id = child_row.id
   returning * into world_state;
  return jsonb_build_object('revision', world_state.revision);
end;
$$;
;
