-- Add the user-provided Arcadia stone guardian as a compact animated pet.
-- The GLB keeps authored Idle plus an in-place Walk_InPlace clip and uses
-- Draco geometry compression with a mobile-sized WebP texture.

begin;

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values (
  'pet',
  '阿卡迪亞',
  '披著古老石甲、用沉穩步伐守護冒險世界的石像夥伴。',
  24,
  'pet.arcadia',
  '/assets/pets/arcadia-thumbnail.webp',
  true,
  false,
  false,
  0.48,
  0.8,
  1.2,
  42,
  jsonb_build_object(
    'source', 'User-provided 阿卡迪亞.fbx + 阿卡迪亞Idle.fbx',
    'model', '/assets/pets/arcadia.glb',
    'thumbnail', '/assets/pets/arcadia-thumbnail.webp',
    'animation', 'Walk_InPlace',
    'idleAnimation', 'Idle',
    'animationStates', jsonb_build_array('idle', 'walk'),
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + 1024px WebP texture + mobile mesh simplification',
    'rootMotion', 'in-place',
    'groundOffset', -0.22,
    'visualScaleMultiplier', 1.6,
    'hideGroundMarker', true,
    'hideGroundShadow', false,
    'groundShadowScaleMultiplier', 0.22,
    'nameLabelPlacement', 'above-head',
    'nameLabelScaleMultiplier', 0.55,
    'idlePauseMinSeconds', 3,
    'idlePauseMaxSeconds', 5,
    'triangleCount', 47103,
    'modelBytes', 882420,
    'textureSize', 1024,
    'simplificationRatio', 0.16
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
