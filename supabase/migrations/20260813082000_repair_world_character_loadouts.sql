-- Repair children created while the world-character catalog migration was
-- not yet applied. The profile selection is authoritative for these supplied
-- characters; make sure the inventory and equipped loadout agree with it.

begin;

do $$
declare
  supported_keys constant text[] := array[
    'character.arthur', 'character.elina', 'character.sia', 'character.elio', 'character.moss', 'character.noah'
  ];
  child_row record;
  selected_item public.game_catalog_items;
  selected_inventory_id uuid;
begin
  for child_row in
    select child.id, child.family_id, child.character_id
    from public.child_profiles child
    where child.character_id = any (supported_keys)
    order by child.id
  loop
    select * into selected_item
    from public.game_catalog_items item
    where item.item_type = 'character'
      and item.asset_key = child_row.character_id
      and item.is_active
    limit 1;

    if not found then
      continue;
    end if;

    selected_inventory_id := null;
    insert into public.child_inventory_items (
      family_id, child_profile_id, catalog_item_id, quantity, acquired_via
    ) values (
      child_row.family_id, child_row.id, selected_item.id, 1, 'grant'
    ) on conflict do nothing returning id into selected_inventory_id;

    if selected_inventory_id is null then
      select inventory.id into selected_inventory_id
      from public.child_inventory_items inventory
      where inventory.child_profile_id = child_row.id
        and inventory.catalog_item_id = selected_item.id
      order by inventory.acquired_at, inventory.id
      limit 1;
    end if;

    insert into public.child_game_loadouts (
      family_id, child_profile_id, equipped_character_inventory_id
    ) values (
      child_row.family_id, child_row.id, selected_inventory_id
    ) on conflict (child_profile_id) do update
      set equipped_character_inventory_id = excluded.equipped_character_inventory_id,
          updated_at = timezone('utc', now());
  end loop;
end;
$$;

-- Keep future child creation on the same supported-character set even if this
-- repair is applied independently after a partial deployment.
create or replace function private.initialize_child_game_data(target_family_id uuid, target_child_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  starter_item public.game_catalog_items;
  starter_inventory_id uuid;
  selected_character_id text;
  supplied_character_keys constant text[] := array[
    'character.arthur', 'character.elina', 'character.sia', 'character.elio', 'character.moss', 'character.noah'
  ];
begin
  insert into public.child_game_wallets (family_id, child_profile_id)
  values (target_family_id, target_child_profile_id)
  on conflict (child_profile_id) do nothing;

  insert into public.child_world_states (family_id, child_profile_id)
  values (target_family_id, target_child_profile_id)
  on conflict (child_profile_id) do nothing;

  select character_id into selected_character_id
  from public.child_profiles
  where family_id = target_family_id and id = target_child_profile_id;

  if selected_character_id = any (supplied_character_keys) then
    select * into starter_item
    from public.game_catalog_items
    where item_type = 'character'
      and asset_key = selected_character_id
      and is_active
    limit 1;
  end if;

  if starter_item.id is null then
    select * into starter_item
    from public.game_catalog_items
    where item_type = 'character'
      and asset_key = 'character.arthur'
      and is_active
    limit 1;
  end if;

  if starter_item.id is not null then
    insert into public.child_inventory_items (
      family_id, child_profile_id, catalog_item_id, quantity, acquired_via
    ) values (
      target_family_id, target_child_profile_id, starter_item.id, 1, 'starter'
    ) on conflict do nothing returning id into starter_inventory_id;
    if starter_inventory_id is null then
      select id into starter_inventory_id
      from public.child_inventory_items
      where child_profile_id = target_child_profile_id
        and catalog_item_id = starter_item.id
      limit 1;
    end if;
    insert into public.child_game_loadouts (
      family_id, child_profile_id, equipped_character_inventory_id
    ) values (
      target_family_id, target_child_profile_id, starter_inventory_id
    ) on conflict (child_profile_id) do update
      set equipped_character_inventory_id = coalesce(
        public.child_game_loadouts.equipped_character_inventory_id,
        excluded.equipped_character_inventory_id
      );
  end if;
end;
$$;

revoke all on function private.initialize_child_game_data(uuid, uuid) from public, anon, authenticated;

commit;
