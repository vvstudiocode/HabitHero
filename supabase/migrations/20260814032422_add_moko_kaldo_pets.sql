-- Add the user-provided Moko and Kaldo as compact animated pets.
-- Both GLBs keep authored Idle + in-place Walk_InPlace clips, Draco geometry,
-- and WebP textures so the shop payload stays suitable for mobile delivery.

begin;

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values
(
  'pet',
  '莫可',
  '穿著星月拼布、用溫暖笑容陪你探索冒險世界的夢境夥伴。',
  19,
  'pet.moko',
  '/assets/pets/moko-thumbnail.png',
  true,
  false,
  false,
  0.34,
  0.8,
  1.2,
  37,
  jsonb_build_object(
    'source', 'User-provided 莫可.fbx + 莫可idle.fbx',
    'model', '/assets/pets/moko.glb',
    'thumbnail', '/assets/pets/moko-thumbnail.png',
    'animation', 'Walk_InPlace',
    'idleAnimation', 'Idle',
    'animationStates', jsonb_build_array('idle', 'walk'),
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + WebP texture + mobile mesh simplification',
    'rootMotion', 'in-place',
    'groundOffset', -0.22,
    'hideGroundMarker', true,
    'hideGroundShadow', false,
    'groundShadowScaleMultiplier', 0.22,
    'nameLabelScaleMultiplier', 0.33,
    'idlePauseSeconds', 10,
    'triangleCount', 91027,
    'modelBytes', 1842964
  )
),
(
  'pet',
  '卡爾多',
  '燃燒著溫柔火光、用穩健步伐守護你探索冒險世界的熔岩夥伴。',
  20,
  'pet.kaldo',
  '/assets/pets/kaldo-thumbnail.png',
  true,
  false,
  false,
  0.4,
  0.8,
  1.2,
  38,
  jsonb_build_object(
    'source', 'User-provided 卡爾多.fbx + 卡爾多Idle.fbx',
    'model', '/assets/pets/kaldo.glb',
    'thumbnail', '/assets/pets/kaldo-thumbnail.png',
    'animation', 'Walk_InPlace',
    'idleAnimation', 'Idle',
    'animationStates', jsonb_build_array('idle', 'walk'),
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + WebP texture + mobile mesh simplification',
    'rootMotion', 'in-place',
    'groundOffset', -0.22,
    'hideGroundMarker', true,
    'hideGroundShadow', false,
    'groundShadowScaleMultiplier', 0.22,
    'nameLabelScaleMultiplier', 0.33,
    'idlePauseSeconds', 10,
    'triangleCount', 163544,
    'modelBytes', 1610508
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
