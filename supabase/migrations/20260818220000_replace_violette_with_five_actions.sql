-- Replace Violette's old two-clip GLB with the five supplied FBX actions.
-- The five source files are packed into one shared-mesh GLB for mobile use.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'User-provided 薇歐莉特Idle.fbx + 薇歐莉特.fbx + 薇歐莉特坐下.fbx + 薇歐莉特揮手.fbx + 薇歐莉特跳舞.fbx',
      'model', '/assets/characters/violette.glb',
      'thumbnail', '/assets/characters/violette-thumbnail.webp',
      'animation', 'Walk_InPlace',
      'idleAnimation', 'Idle',
      'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
      'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
      'renderMode', 'animated-glb',
      'visualStyle', 'warm-hand-painted',
      'compression', 'Draco mesh compression + 1024px WebP texture + mobile mesh simplification',
      'walkRootMotion', 'source-preserved',
      'meshSharedAcrossActions', true,
      'triangleCount', 39158,
      'textureSize', 1024,
      'simplificationRatio', 0.12,
      'modelBytes', 1159320
    ),
    updated_at = timezone('utc', now())
where item_type = 'character'
  and asset_key = 'character.violette';

commit;
