-- Replace Noah's legacy two-clip GLB with one shared-mesh GLB containing all
-- five supplied actions. The public asset is packaged at build time; this
-- migration keeps the catalog metadata aligned with that local asset.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'User-provided 諾亞.fbx + 諾亞Idle.fbx + 諾亞坐下.fbx + 諾亞揮手.fbx + 諾亞跳舞.fbx',
      'model', '/assets/characters/noah.glb',
      'thumbnail', '/assets/characters/noah-thumbnail.webp',
      'animation', 'Walk_InPlace',
      'idleAnimation', 'Idle',
      'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
      'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
      'renderMode', 'animated-glb',
      'compression', 'Draco mesh compression + 1024px WebP texture + mobile mesh simplification',
      'rootMotion', 'in-place',
      'meshSharedAcrossActions', true,
      'modelBytes', 1067948,
      'triangleCount', 39558,
      'textureSize', 1024,
      'simplificationRatio', 0.12
    ),
    updated_at = timezone('utc', now())
where item_type = 'character'
  and asset_key = 'character.noah';

commit;
