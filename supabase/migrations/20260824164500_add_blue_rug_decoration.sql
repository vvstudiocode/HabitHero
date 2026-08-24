-- Add the supplied blue rug as a floor decoration that never blocks navigation.
-- collision_radius stays positive for server-side transform validation;
-- passThrough removes the client navigation obstacle entirely.

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
  '藍地毯',
  '深藍色圓心織紋地毯，鋪在冒險世界的地面上也不會阻擋行走。',
  6,
  'decoration.blue-rug',
  '/assets/decorations/blue-rug-thumbnail.png',
  true,
  false,
  true,
  0.05,
  0.4,
  1.35,
  160,
  jsonb_build_object(
    'model', '/assets/decorations/blue-rug.glb',
    'thumbnail', '/assets/decorations/blue-rug-thumbnail.png',
    'renderMode', 'static-glb',
    'defaultScale', 0.85,
    'groundOffset', 0.0219800007,
    'passThrough', true,
    'groundCoverWidth', 1.96,
    'groundCoverDepth', 1.96,
    'groundCoverEdgeSoftness', 0.12,
    'allowDecorationOverlap', true,
    'triangleCount', 275200,
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
