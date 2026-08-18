-- Repack Nibus from the five supplied FBX files as a fully in-place Walk clip.
-- The source Walk has no displacement; runtime steering owns actor movement.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'User-provided 尼布斯.fbx + 尼布斯Sad Idle.fbx + 尼布斯坐下.fbx + 尼布斯揮手.fbx + 尼布斯跳舞.fbx',
      'model', '/assets/pets/nibus.glb',
      'animation', 'Walk_InPlace',
      'idleAnimation', 'Idle',
      'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
      'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
      'renderMode', 'animated-glb',
      'compression', 'Draco mesh compression + 1024px WebP texture + mobile mesh simplification',
      'rootMotion', 'in-place',
      'meshSharedAcrossActions', true,
      'modelBytes', 1327240,
      'triangleCount', 177117,
      'simplificationRatio', 0.45
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.nibus';

commit;
