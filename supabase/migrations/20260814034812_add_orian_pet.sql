-- Add the user-provided Orian character as a compact animated pet.
-- The world owns translation, so the supplied walk clip is normalized to
-- Walk_InPlace and the authored Idle clip remains available to the runtime.

begin;

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values (
  'pet',
  '奧利安',
  '披著星空與月光、陪你在草地世界裡靜靜探索的星辰夥伴。',
  21,
  'pet.orian',
  '/assets/pets/orian-thumbnail.png',
  true,
  false,
  false,
  0.34,
  0.8,
  1.2,
  39,
  jsonb_build_object(
    'source', 'User-provided 奧利安.fbx + 奧利安idle.fbx',
    'model', '/assets/pets/orian.glb',
    'thumbnail', '/assets/pets/orian-thumbnail.png',
    'animation', 'Walk_InPlace',
    'idleAnimation', 'Idle',
    'animationStates', jsonb_build_array('idle', 'walk'),
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + WebP texture + mobile mesh simplification',
    'rootMotion', 'in-place',
    'groundOffset', -0.22,
    'hideGroundMarker', true,
    'hideGroundShadow', false,
    'groundShadowScaleMultiplier', 0.22,
    'nameLabelScaleMultiplier', 0.33,
    'idlePauseSeconds', 10,
    'triangleCount', 118615,
    'modelBytes', 1998016
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
