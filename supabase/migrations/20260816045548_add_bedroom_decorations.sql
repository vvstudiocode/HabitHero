-- Add the supplied low-poly bedroom furniture to the decoration catalog.
-- The GLBs are Draco/WebP compressed and keep their measured triangle counts
-- in metadata so the asset contract can guard against accidental regressions.

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
values
  (
    'decoration',
    '木製床',
    '柔軟的床鋪，讓冒險一天後的房間多一個安心角落。',
    10,
    'decoration.bed',
    '/assets/decorations/bed-thumbnail.png',
    true,
    false,
    true,
    1.05,
    0.35,
    1.15,
    70,
    jsonb_build_object(
      'model', '/assets/decorations/bed.glb',
      'thumbnail', '/assets/decorations/bed-thumbnail.png',
      'renderMode', 'static-glb',
      'defaultScale', 0.82,
      'groundOffset', 0.426,
      'triangleCount', 4484,
      'textureSize', 1024,
      'simplificationRatio', 0.0075,
      'compression', 'Draco geometry + WebP textures + attribute-aware mesh simplification'
    )
  ),
  (
    'decoration',
    '床頭櫃',
    '放在床邊的小木櫃，替房間收好冒險中的小物件。',
    6,
    'decoration.nightstand',
    '/assets/decorations/nightstand-thumbnail.png',
    true,
    false,
    true,
    0.52,
    0.25,
    0.8,
    80,
    jsonb_build_object(
      'model', '/assets/decorations/nightstand.glb',
      'thumbnail', '/assets/decorations/nightstand-thumbnail.png',
      'renderMode', 'static-glb',
      'defaultScale', 0.5,
      'groundOffset', 1,
      'triangleCount', 1921,
      'textureSize', 1024,
      'simplificationRatio', 0.005,
      'compression', 'Draco geometry + WebP textures + attribute-aware mesh simplification'
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
