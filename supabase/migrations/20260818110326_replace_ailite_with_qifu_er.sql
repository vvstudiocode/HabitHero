-- Replace the active 艾莉特 shop entry with the user-provided 齊福爾 pet.
-- Existing 艾莉特 inventory remains renderable through its retained local asset.

begin;

update public.game_catalog_items
set is_active = false,
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.ailite';

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values (
  'pet',
  '齊福爾',
  '擁有海藍絨毛與大耳朵、會用靈巧步伐陪你探索冒險世界的夢幻夥伴。',
  23,
  'pet.qifu-er',
  '/assets/pets/qifu-er-thumbnail.png',
  true,
  false,
  false,
  0.38,
  0.8,
  1.2,
  44,
  jsonb_build_object(
    'source', 'User-provided 齊福爾Idle.fbx + 齊福爾.fbx + 齊福爾坐下.fbx + 齊福爾揮手.fbx + 齊福爾跳舞.fbx',
    'model', '/assets/pets/qifu-er.glb',
    'thumbnail', '/assets/pets/qifu-er-thumbnail.png',
    'animation', 'Walk_InPlace',
    'idleAnimation', 'Idle',
    'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
    'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + 1024px WebP texture + mobile mesh simplification',
    'rootMotion', 'in-place',
    'meshSharedAcrossActions', true,
    'groundOffset', -0.22,
    'visualScaleMultiplier', 2,
    'hideGroundMarker', true,
    'hideGroundShadow', false,
    'groundShadowScaleMultiplier', 0.22,
    'nameLabelScaleMultiplier', 0.55,
    'idlePauseMinSeconds', 3,
    'idlePauseMaxSeconds', 5,
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
