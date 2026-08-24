-- Add the supplied gaming chair as a compact, separately purchasable decoration.

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
  '電競椅',
  '柔軟又有個性的電競椅，替專心完成任務的冒險者準備一個舒服座位。',
  9,
  'decoration.gaming-chair',
  '/assets/decorations/gaming-chair-thumbnail.png',
  true,
  false,
  true,
  0.6,
  0.25,
  0.7,
  150,
  jsonb_build_object(
    'model', '/assets/decorations/gaming-chair.glb',
    'thumbnail', '/assets/decorations/gaming-chair-thumbnail.png',
    'renderMode', 'static-glb',
    'defaultScale', 0.36,
    'groundOffset', 0.9510509968,
    'navigationRadius', 0.44,
    'navigationInset', 0.22,
    'allowDecorationOverlap', true,
    'collisionShape', 'rectangle',
    'collisionWidth', 0.95,
    'collisionDepth', 0.82,
    'triangleCount', 140906,
    'textureSize', 1024,
    'simplificationRatio', 0.5,
    'compression', 'Draco geometry + WebP textures + seam-preserving attribute-aware mesh simplification + preserved MikkTSpace tangents'
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
