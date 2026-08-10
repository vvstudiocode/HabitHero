-- Add the five user-provided ChibiCharacters as selectable world characters.
-- The package contains walk/run clips in every GLB. Redistribution rights for
-- the source package still need to be confirmed before a public release.

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values
  (
    'character', '弓箭手', '帶著弓箭探索森林的敏捷旅人。', 8, 'character.chibi-archer',
    '/assets/chibi-characters/archer-thumbnail.png', true, false, false,
    0.28, 0.9, 1.1, 11,
    '{"source":"User-provided ChibiCharacters package","model":"/assets/chibi-characters/archer.glb","thumbnail":"/assets/chibi-characters/archer-thumbnail.png","animationStates":["idle","walk","run"],"newChildSelectable":true}'::jsonb
  ),
  (
    'character', '騎士', '穿上盔甲守護冒險夥伴。', 9, 'character.chibi-knight',
    '/assets/chibi-characters/knight-thumbnail.png', true, false, false,
    0.3, 0.9, 1.1, 12,
    '{"source":"User-provided ChibiCharacters package","model":"/assets/chibi-characters/knight.glb","thumbnail":"/assets/chibi-characters/knight-thumbnail.png","animationStates":["idle","walk","run"],"newChildSelectable":true}'::jsonb
  ),
  (
    'character', '商人', '背著行囊尋找新奇寶物。', 8, 'character.chibi-merchant',
    '/assets/chibi-characters/merchant-thumbnail.png', true, false, false,
    0.28, 0.9, 1.1, 13,
    '{"source":"User-provided ChibiCharacters package","model":"/assets/chibi-characters/merchant.glb","thumbnail":"/assets/chibi-characters/merchant-thumbnail.png","animationStates":["idle","walk","run"],"newChildSelectable":true}'::jsonb
  ),
  (
    'character', '忍者', '安靜又俐落地穿梭世界。', 8, 'character.chibi-ninja',
    '/assets/chibi-characters/ninja-thumbnail.png', true, false, false,
    0.26, 0.9, 1.1, 14,
    '{"source":"User-provided ChibiCharacters package","model":"/assets/chibi-characters/ninja.glb","thumbnail":"/assets/chibi-characters/ninja-thumbnail.png","animationStates":["idle","walk","run"],"newChildSelectable":true}'::jsonb
  ),
  (
    'character', '學生', '把每天的學習變成一場冒險。', 7, 'character.chibi-student',
    '/assets/chibi-characters/student-thumbnail.png', true, false, false,
    0.27, 0.9, 1.1, 15,
    '{"source":"User-provided ChibiCharacters package","model":"/assets/chibi-characters/student.glb","thumbnail":"/assets/chibi-characters/student-thumbnail.png","animationStates":["idle","walk","run"],"newChildSelectable":true}'::jsonb
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

-- A newly created child gets the selected GLB as the initial equipped item.
-- Legacy profiles keep the original Anime Maiden fallback.
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

  if selected_character_id like 'character.chibi-%' then
    select * into starter_item
    from public.game_catalog_items
    where item_type = 'character'
      and asset_key = selected_character_id
      and is_active
      and coalesce((metadata ->> 'newChildSelectable')::boolean, false)
    limit 1;
  end if;

  if starter_item.id is null then
    select * into starter_item
    from public.game_catalog_items
    where item_type = 'character' and asset_key = 'character.anime-maiden' and is_starter
    limit 1;
  end if;

  if starter_item.id is not null then
    insert into public.child_inventory_items (
      family_id, child_profile_id, catalog_item_id, quantity, acquired_via
    ) values (
      target_family_id, target_child_profile_id, starter_item.id, 1, 'starter'
    ) on conflict do nothing returning id into starter_inventory_id;
    if starter_inventory_id is null then
      select id into starter_inventory_id from public.child_inventory_items
       where child_profile_id = target_child_profile_id and catalog_item_id = starter_item.id limit 1;
    end if;
    insert into public.child_game_loadouts (
      family_id, child_profile_id, equipped_character_inventory_id
    ) values (
      target_family_id, target_child_profile_id, starter_inventory_id
    ) on conflict (child_profile_id) do update
      set equipped_character_inventory_id = coalesce(public.child_game_loadouts.equipped_character_inventory_id, excluded.equipped_character_inventory_id);
  end if;
end;
$$;

revoke all on function private.initialize_child_game_data(uuid, uuid) from public, anon, authenticated;
