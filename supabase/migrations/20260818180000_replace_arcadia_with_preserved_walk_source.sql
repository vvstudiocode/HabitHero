-- Repack Arcadia from the five supplied FBX files while preserving the
-- authored Walk root motion. The runtime will decide how to consume the
-- horizontal motion for roaming.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'User-provided 阿卡迪亞.fbx + 阿卡迪亞Idle.fbx + 阿卡迪亞坐下.fbx + 阿卡迪亞揮手.fbx + 阿卡迪亞跳舞',
      'model', '/assets/pets/arcadia.glb',
      'animation', 'Walk_InPlace',
      'idleAnimation', 'Idle',
      'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
      'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
      'renderMode', 'animated-glb',
      'compression', 'Draco mesh compression + 1024px WebP texture + mobile mesh simplification',
      'rootMotion', 'in-place',
      'meshSharedAcrossActions', true,
      'modelBytes', 954316,
      'walkRootVerticalMotion', 'source-preserved'
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.arcadia';

commit;
