-- A pet that becomes a follower is rendered from the loadout queue. Any
-- previously placed world entity for that inventory item must be retired so a
-- later "待機" action can place one entity again.
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
     and is_active
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
