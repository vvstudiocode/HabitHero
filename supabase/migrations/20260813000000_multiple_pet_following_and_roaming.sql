update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('visualScaleMultiplier', 2),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.yaoguang-deer';

alter table public.child_game_loadouts
  add column if not exists following_pet_inventory_ids uuid[] not null default '{}'::uuid[];

update public.child_game_loadouts
set following_pet_inventory_ids = array[following_pet_inventory_id]
where following_pet_inventory_id is not null
  and cardinality(following_pet_inventory_ids) = 0;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select constraint_row.conname
    from pg_constraint constraint_row
    join pg_class relation_row on relation_row.oid = constraint_row.conrelid
    join pg_namespace namespace_row on namespace_row.oid = relation_row.relnamespace
    where namespace_row.nspname = 'public'
      and relation_row.relname = 'child_world_entities'
      and constraint_row.contype = 'c'
      and pg_get_constraintdef(constraint_row.oid) ilike '%roaming_slot%'
  loop
    execute format('alter table public.child_world_entities drop constraint %I', constraint_name);
  end loop;
end;
$$;

alter table public.child_world_entities
  add constraint child_world_entities_roaming_slot_positive_check
    check (roaming_slot is null or roaming_slot >= 1),
  add constraint child_world_entities_behavior_roaming_slot_check
    check ((behavior_mode = 'wander' and roaming_slot is not null and roaming_slot >= 1) or (behavior_mode <> 'wander' and roaming_slot is null));

update public.child_world_entities
set
  position_x = -3.5 + (((roaming_slot - 1) % 8)::numeric),
  position_y = 0,
  position_z = -3.5 + ((((roaming_slot - 1) / 8) % 8)::numeric)
where entity_kind = 'pet'
  and behavior_mode = 'wander'
  and is_active
  and roaming_slot is not null;

create or replace function public.set_following_pets(
  target_inventory_item_ids uuid[] default '{}'::uuid[],
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
  world_state public.child_world_states;
  selected_id uuid;
  selected_ids uuid[] := coalesce(target_inventory_item_ids, '{}'::uuid[]);
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  if cardinality(selected_ids) <> (
    select count(distinct selected.value)::integer
    from unnest(selected_ids) as selected(value)
  ) then
    raise exception 'following pet queue contains duplicates' using errcode = '22023';
  end if;

  foreach selected_id in array selected_ids loop
    select inventory.* into inventory_row
      from public.child_inventory_items inventory
      join public.game_catalog_items item on item.id = inventory.catalog_item_id
     where inventory.id = selected_id
       and inventory.child_profile_id = child_row.id
       and inventory.quantity > 0
       and item.item_type = 'pet';
    if not found then
      raise exception 'following pet is not owned by this child' using errcode = '42501';
    end if;
  end loop;

  insert into public.child_game_loadouts (
    family_id, child_profile_id, following_pet_inventory_id, following_pet_inventory_ids
  ) values (
    child_row.family_id,
    child_row.id,
    case when cardinality(selected_ids) > 0 then selected_ids[1] else null end,
    selected_ids
  )
  on conflict (child_profile_id) do update
    set following_pet_inventory_id = case when cardinality(excluded.following_pet_inventory_ids) > 0 then excluded.following_pet_inventory_ids[1] else null end,
        following_pet_inventory_ids = excluded.following_pet_inventory_ids;

  update public.child_world_entities
     set is_active = false, roaming_slot = null, behavior_mode = 'idle'
   where child_profile_id = child_row.id
     and entity_kind = 'pet'
     and behavior_mode = 'wander'
     and inventory_item_id = any(selected_ids);

  insert into public.child_world_states (family_id, child_profile_id)
  values (child_row.family_id, child_row.id)
  on conflict (child_profile_id) do nothing;
  select * into world_state
    from public.child_world_states
   where child_profile_id = child_row.id
   for update;
  update public.child_world_states
     set revision = revision + 1
   where child_profile_id = child_row.id
   returning * into world_state;

  return jsonb_build_object('revision', world_state.revision);
end;
$$;

create or replace function public.set_following_pet(
  target_inventory_item_id uuid default null,
  target_child_profile_id uuid default null
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select public.set_following_pets(
    case when target_inventory_item_id is null then '{}'::uuid[] else array[target_inventory_item_id] end,
    target_child_profile_id
  );
$$;

create or replace function public.set_roaming_pets(
  target_inventory_item_ids uuid[] default '{}'::uuid[],
  target_child_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  child_row public.child_profiles;
  loadout_row public.child_game_loadouts;
  inventory_row public.child_inventory_items;
  selected_id uuid;
  slot smallint;
  world_state public.child_world_states;
  entity_row public.child_world_entities;
  selected_ids uuid[] := coalesce(target_inventory_item_ids, '{}'::uuid[]);
  following_ids uuid[];
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  if cardinality(selected_ids) <> (
    select count(distinct selected.value)::integer
    from unnest(selected_ids) as selected(value)
  ) then
    raise exception 'roaming pet queue contains duplicates' using errcode = '22023';
  end if;

  insert into public.child_game_loadouts (family_id, child_profile_id)
  values (child_row.family_id, child_row.id)
  on conflict (child_profile_id) do nothing;
  select * into loadout_row
    from public.child_game_loadouts
   where child_profile_id = child_row.id
   for update;
  following_ids := coalesce(loadout_row.following_pet_inventory_ids, '{}'::uuid[]);
  if cardinality(following_ids) = 0 and loadout_row.following_pet_inventory_id is not null then
    following_ids := array[loadout_row.following_pet_inventory_id];
  end if;
  if following_ids && selected_ids then
    raise exception 'following pet cannot also roam' using errcode = '23514';
  end if;

  insert into public.child_world_states (family_id, child_profile_id)
  values (child_row.family_id, child_row.id)
  on conflict (child_profile_id) do nothing;
  select * into world_state
    from public.child_world_states
   where child_profile_id = child_row.id
   for update;

  update public.child_world_entities
     set behavior_mode = 'idle', roaming_slot = null, is_active = false
   where child_profile_id = child_row.id
     and entity_kind = 'pet'
     and is_active;

  for selected_id, slot in
    select roaming_item.value, roaming_item.ordinal::smallint
      from unnest(selected_ids) with ordinality as roaming_item(value, ordinal)
  loop
    select inventory.* into inventory_row
      from public.child_inventory_items inventory
      join public.game_catalog_items item on item.id = inventory.catalog_item_id
     where inventory.id = selected_id
       and inventory.child_profile_id = child_row.id
       and inventory.quantity > 0
       and item.item_type = 'pet';
    if not found then
      raise exception 'roaming pet is not owned by this child' using errcode = '42501';
    end if;

    select * into entity_row
      from public.child_world_entities
     where child_profile_id = child_row.id
       and inventory_item_id = selected_id
       and entity_kind = 'pet'
     order by updated_at desc
     limit 1
     for update;
    if found then
      update public.child_world_entities
         set behavior_mode = 'wander',
             roaming_slot = slot,
             is_active = true,
             position_x = -3.5 + (((slot - 1) % 8)::numeric),
             position_y = 0,
             position_z = -3.5 + ((((slot - 1) / 8) % 8)::numeric)
       where id = entity_row.id;
    else
      insert into public.child_world_entities (
        family_id, child_profile_id, inventory_item_id, entity_kind,
        position_x, position_y, position_z, behavior_mode, roaming_slot, is_active
      ) values (
        child_row.family_id, child_row.id, selected_id, 'pet',
        -3.5 + (((slot - 1) % 8)::numeric),
        0,
        -3.5 + ((((slot - 1) / 8) % 8)::numeric),
        'wander', slot, true
      );
    end if;
  end loop;

  update public.child_world_entities
     set behavior_mode = 'idle', roaming_slot = null, is_active = false
   where child_profile_id = child_row.id
     and entity_kind = 'pet'
     and not (inventory_item_id = any(selected_ids));

  update public.child_world_states
     set revision = revision + 1
   where child_profile_id = child_row.id
   returning * into world_state;
  return jsonb_build_object('revision', world_state.revision);
end;
$$;

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
  entity_kind text;
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

  entity_kind := case when catalog_row.item_type = 'pet' then 'pet' else 'decoration' end;
  if target_behavior_mode not in ('static', 'idle', 'wander')
     or (entity_kind = 'decoration' and target_behavior_mode <> 'static')
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
  if entity_kind = 'pet' and following_ids && array[target_inventory_item_id] then
    raise exception 'following pet cannot be placed as a roaming pet' using errcode = '23514';
  end if;

  if entity_kind = 'decoration' then
    if (select count(*) from public.child_world_entities
        where child_profile_id = child_row.id
          and inventory_item_id = target_inventory_item_id
          and entity_kind = 'decoration'
          and is_active) >= inventory_row.quantity then
      raise exception 'all owned copies of this decoration are already placed' using errcode = '23505';
    end if;
  elsif exists (
    select 1 from public.child_world_entities
     where child_profile_id = child_row.id
       and inventory_item_id = target_inventory_item_id
       and is_active
  ) then
    raise exception 'world entity is already placed' using errcode = '23505';
  end if;

  if target_behavior_mode = 'wander' and exists (
    select 1 from public.child_world_entities
     where child_profile_id = child_row.id
       and entity_kind = 'pet'
       and behavior_mode = 'wander'
       and is_active
       and roaming_slot = target_roaming_slot
  ) then
    raise exception 'roaming slot is already in use' using errcode = '23505';
  end if;

  perform private.validate_world_transform(
    child_row.id,
    null,
    entity_kind,
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
    child_row.family_id, child_row.id, target_inventory_item_id, entity_kind,
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

revoke all on function public.set_following_pets(uuid[], uuid) from public, anon;
grant execute on function public.set_following_pets(uuid[], uuid) to authenticated;
revoke all on function public.place_world_entity(uuid, bigint, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, smallint, uuid) from public, anon;
grant execute on function public.place_world_entity(uuid, bigint, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, smallint, uuid) to authenticated;
