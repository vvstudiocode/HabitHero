-- Add the supplied adventure table and fountain as static, compressed world decorations.

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
    '冒險桌',
    '擺滿地圖、羅盤與冒險筆記的木桌，替世界留下一個規劃旅程的角落。',
    9,
    'decoration.adventure-table',
    '/assets/decorations/adventure-table-thumbnail.png',
    true,
    false,
    true,
    0.78,
    0.25,
    0.9,
    90,
    jsonb_build_object(
      'model', '/assets/decorations/adventure-table.glb',
      'thumbnail', '/assets/decorations/adventure-table-thumbnail.png',
      'renderMode', 'static-glb',
      'defaultScale', 0.5,
      'groundOffset', 0.5455,
      'triangleCount', 12697,
      'textureSize', 1024,
      'simplificationRatio', 0.025,
      'compression', 'Draco geometry + WebP textures + seam-preserving attribute-aware mesh simplification + MikkTSpace tangents'
    )
  ),
  (
    'decoration',
    '噴泉',
    '安靜流動的小噴泉，讓草地角落多一點清涼與水聲想像。',
    8,
    'decoration.fountain',
    '/assets/decorations/fountain-thumbnail.png',
    true,
    false,
    true,
    0.68,
    0.25,
    0.75,
    100,
    jsonb_build_object(
      'model', '/assets/decorations/fountain.glb',
      'thumbnail', '/assets/decorations/fountain-thumbnail.png',
      'renderMode', 'static-glb',
      'defaultScale', 0.45,
      'groundOffset', 1,
      'triangleCount', 10991,
      'textureSize', 1024,
      'simplificationRatio', 0.0191,
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
