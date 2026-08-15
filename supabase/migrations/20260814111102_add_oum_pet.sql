-- Add the user-provided Oum cabin pet as a compact animated shop item.
-- The shipped GLB contains the authored Idle and in-place Walk_InPlace clips,
-- with Draco geometry and a WebP texture/thumbnail for mobile delivery.

begin;

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values (
  'pet',
  '歐姆',
  '背著溫暖木屋與花草煙囪，陪你在冒險世界裡慢慢散步的家屋夥伴。',
  22,
  'pet.oum',
  '/assets/pets/oum-thumbnail.webp',
  true,
  false,
  false,
  0.38,
  0.8,
  1.2,
  40,
  jsonb_build_object(
    'source', 'User-provided 歐姆.fbx + 歐姆 Idle.fbx',
    'model', '/assets/pets/oum.glb',
    'thumbnail', '/assets/pets/oum-thumbnail.webp',
    'animation', 'Walk_InPlace',
    'idleAnimation', 'Idle',
    'animationStates', jsonb_build_array('idle', 'walk'),
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + 1024px WebP texture + mobile mesh simplification',
    'rootMotion', 'in-place',
    'groundOffset', -0.22,
    'visualScaleMultiplier', 4,
    'hideGroundMarker', true,
    'hideGroundShadow', false,
    'groundShadowScaleMultiplier', 0.22,
    'nameLabelPlacement', 'above-head',
    'nameLabelScaleMultiplier', 0.55,
    'idlePauseMinSeconds', 3,
    'idlePauseMaxSeconds', 5,
    'triangleCount', 78832,
    'modelBytes', 1122708
  )
)
on conflict (item_type, asset_key) do update
set name = excluded.name,
    description = excluded.description,
    scroll_price = excluded.scroll_price,
    thumbnail_url = excluded.thumbnail_url,
    is_active = excluded.is_active,
    is_starter = excluded.is_starter,
    is_stackable = excluded.is_stackable,
    collision_radius = excluded.collision_radius,
    min_scale = excluded.min_scale,
    max_scale = excluded.max_scale,
    sort_order = excluded.sort_order,
    metadata = excluded.metadata,
    updated_at = timezone('utc', now());

commit;
