-- Replace Nibus's two-clip payload with one shared-mesh GLB containing all
-- five supplied actions. The migration only updates catalog metadata; the
-- packaged public/assets/pets/nibus.glb is the runtime asset.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'User-provided 尼布斯.fbx + 尼布斯Sad Idle.fbx + 尼布斯坐下.fbx + 尼布斯揮手.fbx + 尼布斯跳舞.fbx',
      'model', '/assets/pets/nibus.glb',
      'thumbnail', '/assets/pets/nibus-thumbnail.png',
      'animation', 'Walk_InPlace',
      'idleAnimation', 'Idle',
      'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
      'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
      'renderMode', 'animated-glb',
      'compression', 'Draco mesh compression + 1024px WebP texture',
      'rootMotion', 'in-place',
      'meshSharedAcrossActions', true,
      'visualScaleMultiplier', 2,
      'movementSpeedMultiplier', 0.5,
      'groundOffset', -0.22,
      'hideGroundMarker', true,
      'hideGroundShadow', false,
      'groundShadowScaleMultiplier', 0.22,
      'nameLabelPlacement', 'above-head',
      'nameLabelScaleMultiplier', 0.55,
      'idlePauseSeconds', 10,
      'triangleCount', 177117,
      'modelBytes', 964480
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.nibus';

commit;
