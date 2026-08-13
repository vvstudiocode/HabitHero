-- Add the user-provided Murphy Bear as a compact animated pet.
-- The shipped GLB uses Draco geometry compression and WebP textures.

begin;

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values (
  'pet',
  '墨菲熊',
  '披著莓紅斗篷、用溫柔步伐陪你探索冒險世界的可靠熊夥伴。',
  14,
  'pet.murphy-bear',
  '/assets/pets/murphy-bear-thumbnail.png',
  true,
  false,
  false,
  0.36,
  0.8,
  1.2,
  27,
  jsonb_build_object(
    'source', 'User-provided 墨菲熊_骨架.blend',
    'model', '/assets/pets/murphy-bear.glb',
    'thumbnail', '/assets/pets/murphy-bear-thumbnail.png',
    'animation', 'Murphy_Walk_Cycle',
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + WebP textures',
    'triangleCount', 114366,
    'modelBytes', 1851588
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

commit;
