-- Replace Moss's two-clip payload with one shared-mesh GLB containing all
-- five supplied actions. The migration only updates catalog metadata; the
-- packaged public/assets/characters/moss.glb is the runtime asset.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'User-provided 莫斯.fbx + 莫斯idle.fbx + 莫斯坐下.fbx + 莫斯揮手.fbx + 莫斯跳舞.fbx',
      'model', '/assets/characters/moss.glb',
      'thumbnail', '/assets/characters/moss-thumbnail.webp',
      'animation', 'Walk_InPlace',
      'idleAnimation', 'Idle',
      'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
      'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
      'renderMode', 'animated-glb',
      'compression', 'Draco mesh compression + 1024px WebP texture',
      'rootMotion', 'in-place',
      'meshSharedAcrossActions', true,
      'triangleCount', 28813,
      'modelBytes', 546476,
      'textureSize', 1024,
      'simplificationRatio', 0.12
    ),
    updated_at = timezone('utc', now())
where item_type = 'character'
  and asset_key = 'character.moss';

commit;
