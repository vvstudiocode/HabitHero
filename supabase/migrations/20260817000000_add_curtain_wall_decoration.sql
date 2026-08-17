-- Add the supplied curtain wall as a compact, static world decoration.
-- The source GLB is simplified, Draco-compressed, and uses WebP textures for mobile delivery.

insert into public.game_catalog_items (
  item_type,
  name,
  description,
  scroll_price,
  asset_key,
  thumbnail_url,
  is_active,
  is_starter,
  is_stackable,
  collision_radius,
  min_scale,
  max_scale,
  sort_order,
  metadata
)
values (
  'decoration',
  '窗簾牆',
  '一面溫暖的小窗簾牆，替世界角落帶來午後陽光與家的感覺。',
  8,
  'decoration.curtain-wall',
  '/assets/decorations/curtain-wall-thumbnail.webp',
  true,
  false,
  true,
  1,
  0.25,
  0.9,
  110,
  jsonb_build_object(
    'model', '/assets/decorations/curtain-wall.glb',
    'thumbnail', '/assets/decorations/curtain-wall-thumbnail.webp',
    'renderMode', 'static-glb',
    'defaultScale', 0.58,
    'groundOffset', 0.6102,
    'triangleCount', 60082,
    'textureSize', 1024,
    'simplificationRatio', 0.25,
    'compression', 'Draco geometry + WebP textures + mesh simplification'
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
