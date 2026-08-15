-- Replace the previous 3D/procedural pets with the user-provided top-down
-- Farm Animals pixel-art sprite sheets. Remove unreferenced legacy rows and
-- retire rows that are still referenced by historical inventory safely.

update public.child_game_loadouts loadout
set following_pet_inventory_id = null,
    updated_at = timezone('utc', now())
where following_pet_inventory_id is not null
  and exists (
    select 1
    from public.child_inventory_items inventory
    join public.game_catalog_items item on item.id = inventory.catalog_item_id
    where inventory.id = loadout.following_pet_inventory_id
      and item.item_type = 'pet'
  );

update public.child_world_entities
set is_active = false,
    behavior_mode = 'idle',
    roaming_slot = null,
    updated_at = timezone('utc', now())
where entity_kind = 'pet';

update public.game_catalog_items
set is_active = false,
    updated_at = timezone('utc', now())
where item_type = 'pet';

-- Catalog rows are referenced with ON DELETE RESTRICT so purchases and owned
-- inventory remain auditable. Delete only legacy pets that have no references;
-- referenced rows stay inactive and are hidden by the client.
delete from public.game_catalog_items item
where item.item_type = 'pet'
  and item.asset_key not in (
    'pet.farm-bull',
    'pet.farm-calf',
    'pet.farm-chick',
    'pet.farm-lamb',
    'pet.farm-piglet',
    'pet.farm-rooster',
    'pet.farm-sheep',
    'pet.farm-turkey'
  )
  and not exists (
    select 1 from public.family_game_item_prices price
    where price.catalog_item_id = item.id
  )
  and not exists (
    select 1 from public.game_item_purchases purchase
    where purchase.catalog_item_id = item.id
  )
  and not exists (
    select 1 from public.child_inventory_items inventory
    where inventory.catalog_item_id = item.id
  );

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values
  (
    'pet', '大公牛', '穩穩踏過草地的可靠農場夥伴。', 6, 'pet.farm-bull',
    '/assets/farm-animals/bull-thumbnail.png', true, false, false,
    0.45, 0.75, 1.3, 20,
    '{"source":"User-provided Craftpix farm animals","spriteSheet":"/assets/farm-animals/bull-spritesheet.png","thumbnail":"/assets/farm-animals/bull-thumbnail.png","spriteColumns":6,"spriteRows":8}'::jsonb
  ),
  (
    'pet', '小牛', '跟著牧場風一起輕快散步的小牛。', 5, 'pet.farm-calf',
    '/assets/farm-animals/calf-thumbnail.png', true, false, false,
    0.4, 0.75, 1.3, 22,
    '{"source":"User-provided Craftpix farm animals","spriteSheet":"/assets/farm-animals/calf-spritesheet.png","thumbnail":"/assets/farm-animals/calf-thumbnail.png","spriteColumns":6,"spriteRows":8}'::jsonb
  ),
  (
    'pet', '小雞', '在花草間蹦蹦跳跳的小小夥伴。', 3, 'pet.farm-chick',
    '/assets/farm-animals/chick-thumbnail.png', true, false, false,
    0.18, 0.7, 1.35, 24,
    '{"source":"User-provided Craftpix farm animals","spriteSheet":"/assets/farm-animals/chick-spritesheet.png","thumbnail":"/assets/farm-animals/chick-thumbnail.png","spriteColumns":6,"spriteRows":8}'::jsonb
  ),
  (
    'pet', '小羊', '溫柔地在草原上閒晃的小羊。', 5, 'pet.farm-lamb',
    '/assets/farm-animals/lamb-thumbnail.png', true, false, false,
    0.3, 0.75, 1.35, 26,
    '{"source":"User-provided Craftpix farm animals","spriteSheet":"/assets/farm-animals/lamb-spritesheet.png","thumbnail":"/assets/farm-animals/lamb-thumbnail.png","spriteColumns":6,"spriteRows":8}'::jsonb
  ),
  (
    'pet', '小豬', '圓滾滾地在冒險世界裡找朋友。', 5, 'pet.farm-piglet',
    '/assets/farm-animals/piglet-thumbnail.png', true, false, false,
    0.3, 0.75, 1.35, 28,
    '{"source":"User-provided Craftpix farm animals","spriteSheet":"/assets/farm-animals/piglet-spritesheet.png","thumbnail":"/assets/farm-animals/piglet-thumbnail.png","spriteColumns":6,"spriteRows":8}'::jsonb
  ),
  (
    'pet', '公雞', '用精神滿滿的步伐巡視整片草地。', 5, 'pet.farm-rooster',
    '/assets/farm-animals/rooster-thumbnail.png', true, false, false,
    0.25, 0.75, 1.35, 30,
    '{"source":"User-provided Craftpix farm animals","spriteSheet":"/assets/farm-animals/rooster-spritesheet.png","thumbnail":"/assets/farm-animals/rooster-thumbnail.png","spriteColumns":6,"spriteRows":8}'::jsonb
  ),
  (
    'pet', '綿羊', '毛茸茸地陪你慢慢探索森林邊緣。', 5, 'pet.farm-sheep',
    '/assets/farm-animals/sheep-thumbnail.png', true, false, false,
    0.32, 0.75, 1.35, 32,
    '{"source":"User-provided Craftpix farm animals","spriteSheet":"/assets/farm-animals/sheep-spritesheet.png","thumbnail":"/assets/farm-animals/sheep-thumbnail.png","spriteColumns":6,"spriteRows":8}'::jsonb
  ),
  (
    'pet', '火雞', '帶著豐盛羽毛在世界裡悠閒散步。', 5, 'pet.farm-turkey',
    '/assets/farm-animals/turkey-thumbnail.png', true, false, false,
    0.3, 0.75, 1.35, 34,
    '{"source":"User-provided Craftpix farm animals","spriteSheet":"/assets/farm-animals/turkey-spritesheet.png","thumbnail":"/assets/farm-animals/turkey-thumbnail.png","spriteColumns":6,"spriteRows":8}'::jsonb
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
