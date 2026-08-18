-- Replace Oum's two-clip payload with one shared-mesh GLB containing all
-- five supplied actions. The migration only updates catalog metadata; the
-- packaged public/assets/pets/oum.glb is the runtime asset.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'User-provided 歐姆.fbx + 歐姆 Idle.fbx + 歐姆坐下.fbx + 歐姆揮手.fbx + 歐姆跳舞.fbx',
      'model', '/assets/pets/oum.glb',
      'thumbnail', '/assets/pets/oum-thumbnail.webp',
      'animation', 'Walk_InPlace',
      'idleAnimation', 'Idle',
      'animationClips', jsonb_build_array('Idle', 'Walk_InPlace', 'Sit', 'Wave', 'Dance'),
      'animationStates', jsonb_build_array('idle', 'walk', 'sit', 'wave', 'dance'),
      'renderMode', 'animated-glb',
      'compression', 'Draco mesh compression + 1024px WebP texture',
      'rootMotion', 'in-place',
      'meshSharedAcrossActions', true,
      'groundOffset', -0.22,
      'visualScaleMultiplier', 4,
      'hideGroundMarker', true,
      'hideGroundShadow', false,
      'groundShadowScaleMultiplier', 0.22,
      'nameLabelPlacement', 'above-head',
      'nameLabelScaleMultiplier', 0.55,
      'idlePauseMinSeconds', 3,
      'idlePauseMaxSeconds', 5,
      'triangleCount', 62598,
      'modelBytes', 1143040
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.oum';

commit;
