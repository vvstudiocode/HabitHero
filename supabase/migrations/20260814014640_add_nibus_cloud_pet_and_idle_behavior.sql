-- Add the user-provided Nibus cloud as a compact animated pet.
-- The GLB combines Walk + Sad Idle, with Draco geometry compression and a
-- WebP texture exported for mobile delivery.

begin;

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values (
  'pet',
  '尼布斯',
  '柔軟的雲朵精靈，會帶著溫柔的光陪你探索冒險世界。',
  16,
  'pet.nibus',
  '/assets/pets/nibus-thumbnail.png',
  true,
  false,
  false,
  0.34,
  0.8,
  1.2,
  35,
  jsonb_build_object(
    'source', 'User-provided 尼布斯.fbx + 尼布斯Sad Idle.fbx',
    'model', '/assets/pets/nibus.glb',
    'thumbnail', '/assets/pets/nibus-thumbnail.png',
    'animation', 'Walk',
    'idleAnimation', 'Idle',
    'animationStates', jsonb_build_array('idle', 'walk'),
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + WebP texture',
    'triangleCount', 177117,
    'modelBytes', 1401764
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
