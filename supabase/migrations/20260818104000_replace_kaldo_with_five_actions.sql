-- Replace Kaldo's two-clip payload with one shared-mesh GLB containing all
-- five supplied actions. The migration only updates catalog metadata; the
-- packaged public/assets/pets/kaldo.glb is the runtime asset.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'User-provided 卡爾多Idle.fbx + 卡爾多坐下.fbx + 卡爾多揮手.fbx + 卡爾多.fbx + 卡爾多跳舞.fbx',
      'model', '/assets/pets/kaldo.glb',
      'thumbnail', '/assets/pets/kaldo-thumbnail.png',
      'animation', 'Walk_InPlace',
      'idleAnimation', 'Idle',
      'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
      'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
      'renderMode', 'animated-glb',
      'compression', 'Draco mesh compression + 1024px WebP texture',
      'rootMotion', 'in-place',
      'meshSharedAcrossActions', true,
      'triangleCount', 163544,
      'modelBytes', 1138700
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.kaldo';

commit;
