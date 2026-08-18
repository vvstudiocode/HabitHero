-- Add the user-provided 艾莉特 as a compact animated shop pet.
-- The GLB contains one shared mesh with Idle, in-place Walk, and three actions.

begin;

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values (
  'pet',
  '艾莉特',
  '帶著彩繪鱗片與明亮大眼睛、用活潑步伐陪你探索冒險世界的彩虹龍夥伴。',
  23,
  'pet.ailite',
  '/assets/pets/ailite-thumbnail.png',
  true,
  false,
  false,
  0.38,
  0.8,
  1.2,
  44,
  jsonb_build_object(
    'source', 'User-provided 艾莉特idle.fbx + 艾莉特.fbx + 艾莉特坐下.fbx + 艾莉特揮手.fbx + 艾莉特跳舞.fbx',
    'model', '/assets/pets/ailite.glb',
    'thumbnail', '/assets/pets/ailite-thumbnail.png',
    'animation', 'Walk_InPlace',
    'idleAnimation', 'Idle',
    'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
    'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + 1024px WebP texture + mobile mesh simplification',
    'rootMotion', 'in-place',
    'meshSharedAcrossActions', true,
    'groundOffset', -0.22,
    'hideGroundMarker', true,
    'hideGroundShadow', false,
    'groundShadowScaleMultiplier', 0.22,
    'nameLabelScaleMultiplier', 0.55,
    'idlePauseMinSeconds', 3,
    'idlePauseMaxSeconds', 5,
    'triangleCount', 44494,
    'modelBytes', 1363920,
    'textureSize', 1024,
    'simplificationRatio', 0.12
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
