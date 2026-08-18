-- Replace Arcadia's two-clip payload with one shared-mesh GLB containing all
-- five supplied actions. The migration only updates catalog metadata; the
-- packaged public/assets/pets/arcadia.glb is the runtime asset.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'User-provided 阿卡迪亞.fbx + 阿卡迪亞Idle.fbx + 阿卡迪亞坐下.fbx + 阿卡迪亞揮手.fbx + 阿卡迪亞跳舞',
      'model', '/assets/pets/arcadia.glb',
      'thumbnail', '/assets/pets/arcadia-thumbnail.webp',
      'animation', 'Walk_InPlace',
      'idleAnimation', 'Idle',
      'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
      'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
      'renderMode', 'animated-glb',
      'compression', 'Draco mesh compression + 1024px WebP texture + mobile mesh simplification',
      'rootMotion', 'in-place',
      'meshSharedAcrossActions', true,
      'groundOffset', -0.44,
      'visualScaleMultiplier', 6.8,
      'hideGroundMarker', true,
      'hideGroundShadow', false,
      'groundShadowScaleMultiplier', 0.22,
      'nameLabelPlacement', 'above-head',
      'nameLabelScaleMultiplier', 0.55,
      'idlePauseMinSeconds', 3,
      'idlePauseMaxSeconds', 5,
      'triangleCount', 47103,
      'modelBytes', 701352,
      'textureSize', 1024,
      'simplificationRatio', 0.16
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.arcadia';

commit;
