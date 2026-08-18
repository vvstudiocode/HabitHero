-- Repack Oum from the five supplied FBX files while preserving the authored
-- Walk root motion. The runtime will decide how to consume horizontal motion
-- for roaming.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'User-provided 歐姆.fbx + 歐姆 Idle.fbx + 歐姆坐下.fbx + 歐姆揮手.fbx + 歐姆跳舞.fbx',
      'model', '/assets/pets/oum.glb',
      'animation', 'Walk_InPlace',
      'idleAnimation', 'Idle',
      'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
      'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
      'renderMode', 'animated-glb',
      'compression', 'Draco mesh compression + 1024px WebP texture + mobile mesh simplification',
      'rootMotion', 'in-place',
      'meshSharedAcrossActions', true,
      'modelBytes', 1431792,
      'walkRootVerticalMotion', 'source-preserved',
      'triangleCount', 62605,
      'simplificationRatio', 0.12
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.oum';

commit;
