-- Add Jasmine as a compact animated shop pet and extend Christo with the
-- supplied Sit, Wave, and Dance clips. Each GLB stores one shared mesh and
-- texture set with all five clips so the app does not download duplicate pets.

begin;

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values (
  'pet',
  '茉莉',
  '帶著葉芽與溫柔笑容，陪你一起探索冒險世界的森林夥伴。',
  21,
  'pet.jasmine',
  '/assets/pets/jasmine-thumbnail.png',
  true,
  false,
  false,
  0.34,
  0.8,
  1.2,
  43,
  jsonb_build_object(
    'source', 'User-provided 茉莉Idle.fbx + 茉莉walk.fbx + 茉莉坐下.fbx + 茉莉揮手.fbx + 茉莉跳舞.fbx',
    'model', '/assets/pets/jasmine.glb',
    'thumbnail', '/assets/pets/jasmine-thumbnail.png',
    'animation', 'Walk_InPlace',
    'idleAnimation', 'Idle',
    'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
    'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + 1024px WebP texture + mobile mesh simplification',
    'rootMotion', 'in-place',
    'triangleCount', 60815,
    'modelBytes', 785508,
    'textureSize', 1024,
    'simplificationRatio', 0.2
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

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'User-provided 克里斯多.fbx + 克里斯多idle.fbx + 克里斯多坐下.fbx + 克里斯多揮手.fbx + 克里斯多跳舞.fbx',
      'model', '/assets/pets/christo.glb',
      'thumbnail', '/assets/pets/christo-thumbnail.png',
      'animation', 'Walk_InPlace',
      'idleAnimation', 'Idle',
      'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
      'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
      'renderMode', 'animated-glb',
      'compression', 'Draco mesh compression + 1024px WebP texture',
      'rootMotion', 'in-place',
      'triangleCount', 137576,
      'modelBytes', 1279788
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.christo';

commit;
