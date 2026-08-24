-- Add the supplied stone fire pit with a runtime-scaled point-light effect.

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
  '石火堆',
  '圍著圓石的溫暖火堆，會用柔和火光照亮附近環境。',
  8,
  'decoration.stone-fire-pit',
  '/assets/decorations/stone-fire-pit-thumbnail.png',
  true,
  false,
  true,
  0.65,
  0.5,
  1.3,
  180,
  jsonb_build_object(
    'model', '/assets/decorations/stone-fire-pit.glb',
    'thumbnail', '/assets/decorations/stone-fire-pit-thumbnail.png',
    'renderMode', 'static-glb',
    'defaultScale', 1,
    'groundOffset', 0,
    'pointLight', true,
    'pointLightColor', 16751181,
    'pointLightIntensity', 2.2,
    'pointLightDistance', 3.2,
    'pointLightHeight', 0.34,
    'triangleCount', 49768,
    'textureSize', 1024,
    'simplificationRatio', 0.5,
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
