-- Replace Moko's two-clip payload with one shared-mesh GLB containing all
-- five supplied actions. The migration only updates catalog metadata; the
-- packaged public/assets/pets/moko.glb is the runtime asset.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'User-provided 莫可Idle.fbx + 莫可坐下.fbx + 莫可揮手.fbx + 莫可.fbx + 莫可跳舞.fbx',
      'model', '/assets/pets/moko.glb',
      'thumbnail', '/assets/pets/moko-thumbnail.png',
      'animation', 'Walk_InPlace',
      'idleAnimation', 'Idle',
      'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
      'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
      'renderMode', 'animated-glb',
      'compression', 'Draco mesh compression + 1024px WebP texture',
      'rootMotion', 'in-place',
      'meshSharedAcrossActions', true,
      'groundOffset', -0.22,
      'hideGroundMarker', true,
      'hideGroundShadow', false,
      'groundShadowScaleMultiplier', 0.22,
      'nameLabelScaleMultiplier', 0.33,
      'idlePauseSeconds', 10,
      'triangleCount', 72821,
      'modelBytes', 1457608
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.moko';

commit;
