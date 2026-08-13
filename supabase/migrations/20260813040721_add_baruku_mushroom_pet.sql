-- Add the user-provided Baruku mushroom as a compact animated pet.
-- The shipped GLB uses Draco geometry compression and embedded WebP textures.

begin;

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values (
  'pet',
  '巴魯菇',
  '戴著暖橘菇帽、用輕快步伐陪你探索冒險世界的蘑菇夥伴。',
  14,
  'pet.baruku-mushroom',
  '/assets/pets/baruku-mushroom-thumbnail.png',
  true,
  false,
  false,
  0.34,
  0.8,
  1.2,
  31,
  jsonb_build_object(
    'source', 'User-provided 巴魯菇正確.blend',
    'model', '/assets/pets/baruku-mushroom.glb',
    'thumbnail', '/assets/pets/baruku-mushroom-thumbnail.png',
    'animation', 'Walk_Forward',
    'animationStates', jsonb_build_array('Walk_Forward', 'Walk_InPlace'),
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + WebP textures',
    'triangleCount', 67393,
    'modelBytes', 608100
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
