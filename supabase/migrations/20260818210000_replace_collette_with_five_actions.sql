-- Replace Collette's old two-clip GLB with the five supplied FBX actions.
-- The Walk clip keeps the source-authored root data; runtime movement decides
-- how horizontal root motion is consumed.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'User-provided 柯蕾特Idle.fbx + 柯蕾特.fbx + 柯蕾特坐下.fbx + 柯蕾特揮手.fbx + 柯蕾特跳舞.fbx',
      'model', '/assets/characters/collette.glb',
      'thumbnail', '/assets/characters/collette-thumbnail.webp',
      'animation', 'Walk_InPlace',
      'idleAnimation', 'Idle',
      'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
      'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
      'renderMode', 'animated-glb',
      'visualStyle', 'warm-hand-painted',
      'compression', 'Draco mesh compression + 1024px WebP texture + mobile mesh simplification',
      'walkRootMotion', 'source-preserved',
      'meshSharedAcrossActions', true,
      'triangleCount', 35636,
      'textureSize', 1024,
      'simplificationRatio', 0.12,
      'modelBytes', 1033760
    ),
    updated_at = timezone('utc', now())
where item_type = 'character'
  and asset_key = 'character.collette';

commit;
