-- Add the supplied whimsical computer desk as a separately purchasable
-- decoration while keeping the existing wooden study desk unchanged.

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
  '電腦桌',
  '有螢幕、鍵盤與冒險小物的溫暖木製電腦桌，替世界打造一個專心完成任務的角落。',
  8,
  'decoration.computer-desk',
  '/assets/decorations/computer-desk-thumbnail.png',
  true,
  false,
  true,
  0.95,
  0.25,
  0.8,
  45,
  jsonb_build_object(
    'model', '/assets/decorations/computer-desk.glb',
    'thumbnail', '/assets/decorations/computer-desk-thumbnail.png',
    'renderMode', 'static-glb',
    'defaultScale', 0.62,
    'groundOffset', 0.8533437848,
    'navigationRadius', 0.58,
    'navigationInset', 0.25,
    'allowDecorationOverlap', true,
    'collisionShape', 'rectangle',
    'collisionWidth', 2.0,
    'collisionDepth', 1.17,
    'triangleCount', 230073,
    'textureSize', 1024,
    'simplificationRatio', 0.5,
    'compression', 'Draco geometry + WebP textures + seam-preserving attribute-aware mesh simplification + MikkTSpace tangents'
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
