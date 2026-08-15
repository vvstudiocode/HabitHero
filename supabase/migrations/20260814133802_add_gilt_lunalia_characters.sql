-- Add the supplied Gilt and Lunalia characters as compact animated shop items.
-- If an older deployment already has either key equipped, move that child to
-- another active character before restoring the immutable identity guard.

begin;

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values
(
  'character', '吉爾特', '穿著閃電雨衣，在每一場雨裡收集勇氣與新發現。', 9,
  'character.gilt', '/assets/characters/gilt-thumbnail.webp',
  true, false, false, 0.28, 0.9, 1.1, 18,
  jsonb_build_object(
    'source', 'User-provided 吉爾特.fbx + 吉爾特Idle.fbx',
    'model', '/assets/characters/gilt.glb',
    'thumbnail', '/assets/characters/gilt-thumbnail.webp',
    'animation', 'Walk_InPlace',
    'animationStates', jsonb_build_array('idle', 'walk'),
    'renderMode', 'animated-glb',
    'visualStyle', 'warm-hand-painted',
    'compression', 'Draco mesh compression + WebP textures',
    'modelBytes', 1002608
  )
),
(
  'character', '露娜莉亞', '伴著月光與樹影，溫柔地守護每一次夜間冒險。', 9,
  'character.lunalia', '/assets/characters/lunalia-thumbnail.webp',
  true, false, false, 0.28, 0.9, 1.1, 19,
  jsonb_build_object(
    'source', 'User-provided 露娜莉亞.fbx + 露娜莉亞idle.fbx',
    'model', '/assets/characters/lunalia.glb',
    'thumbnail', '/assets/characters/lunalia-thumbnail.webp',
    'animation', 'Walk_InPlace',
    'animationStates', jsonb_build_array('idle', 'walk'),
    'renderMode', 'animated-glb',
    'visualStyle', 'warm-hand-painted',
    'compression', 'Draco mesh compression + WebP textures',
    'modelBytes', 1023488
  )
)
on conflict (item_type, asset_key) do update
set name = excluded.name,
    description = excluded.description,
    scroll_price = excluded.scroll_price,
    thumbnail_url = excluded.thumbnail_url,
    is_active = excluded.is_active,
    is_starter = excluded.is_starter,
    is_stackable = excluded.is_stackable,
    collision_radius = excluded.collision_radius,
    min_scale = excluded.min_scale,
    max_scale = excluded.max_scale,
    sort_order = excluded.sort_order,
    metadata = excluded.metadata,
    updated_at = timezone('utc', now());

drop trigger if exists child_profile_identity_guard on public.child_profiles;

do $$
declare
  supplied_keys constant text[] := array['character.gilt', 'character.lunalia'];
  child_row record;
  replacement_item public.game_catalog_items;
  replacement_inventory_id uuid;
begin
  for child_row in
    select child.id, child.family_id, child.character_id
    from public.child_profiles child
    where child.character_id = any (supplied_keys)
       or exists (
         select 1
         from public.child_game_loadouts loadout
         join public.child_inventory_items inventory
           on inventory.id = loadout.equipped_character_inventory_id
         join public.game_catalog_items item
           on item.id = inventory.catalog_item_id
         where loadout.child_profile_id = child.id
           and item.item_type = 'character'
           and item.asset_key = any (supplied_keys)
       )
    order by child.id
  loop
    replacement_item := null;
    select * into replacement_item
    from public.game_catalog_items
    where item_type = 'character'
      and is_active
      and not (asset_key = any (supplied_keys))
    order by random()
    limit 1;

    if not found then
      continue;
    end if;

    replacement_inventory_id := null;
    insert into public.child_inventory_items (
      family_id, child_profile_id, catalog_item_id, quantity, acquired_via
    ) values (
      child_row.family_id, child_row.id, replacement_item.id, 1, 'grant'
    ) on conflict do nothing returning id into replacement_inventory_id;

    if replacement_inventory_id is null then
      select id into replacement_inventory_id
      from public.child_inventory_items
      where child_profile_id = child_row.id
        and catalog_item_id = replacement_item.id
      order by acquired_at, id
      limit 1;
    end if;

    insert into public.child_game_loadouts (
      family_id, child_profile_id, equipped_character_inventory_id
    ) values (
      child_row.family_id, child_row.id, replacement_inventory_id
    ) on conflict (child_profile_id) do update
      set equipped_character_inventory_id = excluded.equipped_character_inventory_id,
          updated_at = timezone('utc', now());

    update public.child_profiles
    set character_id = replacement_item.asset_key
    where id = child_row.id;
  end loop;
end;
$$;

create trigger child_profile_identity_guard
before update on public.child_profiles
for each row execute function private.enforce_child_identity_immutable();

-- Keep the selected world character when initializing a new child. Arthur is
-- still the fallback for legacy or invalid profile character ids.
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
    'character.arthur', 'character.elina', 'character.sia', 'character.elio',
    'character.moss', 'character.noah', 'character.collette', 'character.violette',
    'character.gilt', 'character.lunalia'
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

