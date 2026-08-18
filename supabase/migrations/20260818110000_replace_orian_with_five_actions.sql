-- Replace Orian's two-clip payload with one shared-mesh GLB containing all
-- five supplied actions. The migration only updates catalog metadata; the
-- packaged public/assets/pets/orian.glb is the runtime asset.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', 'User-provided 奧利安走路.fbx + 奧利安Idle.fbx + 奧利安坐下.fbx + 奧利安揮手.fbx + 奧利安跳舞.fbx',
      'model', '/assets/pets/orian.glb',
      'thumbnail', '/assets/pets/orian-thumbnail.png',
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
      'triangleCount', 118615,
      'modelBytes', 1337824
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.orian';

commit;
