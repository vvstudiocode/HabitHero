-- Replace Gilt's old two-clip GLB with the five supplied FBX actions.
-- The five source files are packed into one shared-mesh GLB for mobile use.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'User-provided 吉爾特Idle.fbx + 吉爾特.fbx + 吉爾特坐下.fbx + 吉爾特揮手.fbx + 吉爾特跳舞.fbx',
      'model', '/assets/characters/gilt.glb',
      'thumbnail', '/assets/characters/gilt-thumbnail.webp',
      'animation', 'Walk_InPlace',
      'idleAnimation', 'Idle',
      'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
      'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
      'renderMode', 'animated-glb',
      'visualStyle', 'warm-hand-painted',
      'compression', 'Draco mesh compression + 1024px WebP texture + mobile mesh simplification',
      'walkRootMotion', 'source-preserved',
      'meshSharedAcrossActions', true,
      'triangleCount', 55259,
      'textureSize', 1024,
      'simplificationRatio', 0.12,
      'modelBytes', 1244056
    ),
    updated_at = timezone('utc', now())
where item_type = 'character'
  and asset_key = 'character.gilt';

commit;
