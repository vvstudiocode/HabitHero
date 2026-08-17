-- Keep a pet's current position when switching from following/idle to roam.
-- The load position is only for a pet that has never had a world entity.
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
     and behavior_mode = 'wander'
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
             is_active = true
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
     and behavior_mode = 'wander'
     and not (inventory_item_id = any(selected_ids));

  update public.child_world_states
     set revision = revision + 1
   where child_profile_id = child_row.id
   returning * into world_state;
  return jsonb_build_object('revision', world_state.revision);
end;
$$;
