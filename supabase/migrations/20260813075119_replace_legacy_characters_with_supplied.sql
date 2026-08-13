-- Replace the legacy character shop with the four supplied, mobile-optimized
-- characters. Legacy catalog rows stay as inactive history because inventory
-- and purchase rows reference them; user-facing ownership is migrated below.

begin;

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values
(
  'character', '亞瑟', '帶著溫暖笑容、勇敢踏上冒險的旅人。', 9,
  'character.arthur', '/assets/characters/arthur-thumbnail.webp',
  true, false, false, 0.28, 0.9, 1.1, 10,
  jsonb_build_object(
    'source', 'User-provided 亞瑟.fbx',
    'model', '/assets/characters/arthur.glb',
    'thumbnail', '/assets/characters/arthur-thumbnail.webp',
    'animation', 'Walk_InPlace',
    'animationStates', jsonb_build_array('walk'),
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + WebP textures'
  )
),
(
  'character', '艾利娜', '帶著輕盈步伐探索日常的小小冒險家。', 10,
  'character.elina', '/assets/characters/elina-thumbnail.webp',
  true, false, false, 0.28, 0.9, 1.1, 11,
  jsonb_build_object(
    'source', 'User-provided 艾利娜.fbx',
    'model', '/assets/characters/elina.glb',
    'thumbnail', '/assets/characters/elina-thumbnail.webp',
    'animation', 'Walk_InPlace',
    'animationStates', jsonb_build_array('walk'),
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + WebP textures'
  )
),
(
  'character', '希雅', '細心觀察世界、總能發現新線索的夥伴。', 8,
  'character.sia', '/assets/characters/sia-thumbnail.webp',
  true, false, false, 0.28, 0.9, 1.1, 12,
  jsonb_build_object(
    'source', 'User-provided 希雅.fbx',
    'model', '/assets/characters/sia.glb',
    'thumbnail', '/assets/characters/sia-thumbnail.webp',
    'animation', 'Walk_InPlace',
    'animationStates', jsonb_build_array('walk'),
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + WebP textures'
  )
),
(
  'character', '艾利歐', '背著小行囊，準備好迎接每一個新發現。', 8,
  'character.elio', '/assets/characters/elio-thumbnail.webp',
  true, false, false, 0.28, 0.9, 1.1, 13,
  jsonb_build_object(
    'source', 'User-provided 艾利歐.fbx',
    'model', '/assets/characters/elio.glb',
    'thumbnail', '/assets/characters/elio-thumbnail.webp',
    'animation', 'Walk_InPlace',
    'animationStates', jsonb_build_array('walk'),
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + WebP textures'
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

-- The identity guard intentionally blocks normal product updates. Temporarily
-- remove only this trigger inside the atomic migration, then restore it before
-- commit so the replacement remains a one-time administrative operation.
drop trigger if exists child_profile_identity_guard on public.child_profiles;

do $$
declare
  legacy_character_keys constant text[] := array[
    'character.anime-maiden',
    'character.starlight-adventurer',
    'character.chibi-archer',
    'character.chibi-knight',
    'character.chibi-merchant',
    'character.chibi-ninja',
    'character.chibi-student'
  ];
  replacement_keys constant text[] := array[
    'character.arthur', 'character.elina', 'character.sia', 'character.elio'
  ];
  child_row record;
  replacement_item public.game_catalog_items;
  replacement_inventory_id uuid;
  replacement_index integer := 0;
  equipped_legacy boolean;
begin
  for child_row in
    select id, family_id, character_id
    from public.child_profiles
    order by id
  loop
    select exists (
      select 1
      from public.child_game_loadouts loadout
      join public.child_inventory_items inventory
        on inventory.id = loadout.equipped_character_inventory_id
      join public.game_catalog_items item
        on item.id = inventory.catalog_item_id
      where loadout.child_profile_id = child_row.id
        and item.item_type = 'character'
        and item.asset_key = any (legacy_character_keys)
    ) into equipped_legacy;

    if child_row.character_id = any (legacy_character_keys) or equipped_legacy then
      select * into replacement_item
      from public.game_catalog_items
      where item_type = 'character'
        and asset_key = replacement_keys[mod(replacement_index, array_length(replacement_keys, 1)) + 1]
        and is_active
      limit 1;
      replacement_index := replacement_index + 1;
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
    end if;
  end loop;

  delete from public.child_inventory_items inventory
  using public.game_catalog_items item
  where inventory.catalog_item_id = item.id
    and item.item_type = 'character'
    and item.asset_key = any (legacy_character_keys)
    and not exists (
      select 1
      from public.child_game_loadouts loadout
      where loadout.equipped_character_inventory_id = inventory.id
    );

  update public.game_catalog_items
  set is_active = false,
      updated_at = timezone('utc', now())
  where item_type = 'character'
    and asset_key = any (legacy_character_keys);
end;
$$;

create trigger child_profile_identity_guard
before update on public.child_profiles
for each row execute function private.enforce_child_identity_immutable();

-- New children may select any supplied character. Arthur is the deterministic
-- fallback so the four shop items remain visible instead of hiding one as a
-- starter-only row.
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
    'character.arthur', 'character.elina', 'character.sia', 'character.elio'
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
