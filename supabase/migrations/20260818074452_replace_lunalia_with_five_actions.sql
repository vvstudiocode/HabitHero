-- Replace Lunalia's old two-clip GLB with the five supplied FBX actions.
-- The five source files are packed into one shared-mesh GLB for mobile use.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'User-provided 露娜莉亞idle.fbx + 露娜莉亞.fbx + 露娜莉亞坐下.fbx + 露娜莉亞揮手.fbx + 露娜莉亞跳舞.fbx',
      'model', '/assets/characters/lunalia.glb',
      'thumbnail', '/assets/characters/lunalia-thumbnail.webp',
      'animation', 'Walk_InPlace',
      'idleAnimation', 'Idle',
      'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
      'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
      'renderMode', 'animated-glb',
      'visualStyle', 'warm-hand-painted',
      'compression', 'Draco mesh compression + 1024px WebP texture + mobile mesh simplification',
      'walkRootMotion', 'source-preserved',
      'meshSharedAcrossActions', true,
      'triangleCount', 49093,
      'textureSize', 1024,
      'simplificationRatio', 0.12,
      'modelBytes', 1311468
    ),
    updated_at = timezone('utc', now())
where item_type = 'character'
  and asset_key = 'character.lunalia';

commit;
