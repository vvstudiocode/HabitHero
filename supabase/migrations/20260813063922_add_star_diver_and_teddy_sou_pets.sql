-- Add the supplied Star Diver and Teddy Sou as compact animated pets.
-- Their GLBs use Draco geometry compression and embedded WebP textures; the
-- shop thumbnails use transparent WebP to keep the mobile payload small.

begin;

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values
(
  'pet',
  '星辰潛者',
  '穿越深藍星海、用溫柔步伐陪你探索冒險世界的潛水夥伴。',
  17,
  'pet.star-diver',
  '/assets/pets/star-diver-thumbnail.webp',
  true,
  false,
  false,
  0.36,
  0.8,
  1.2,
  32,
  jsonb_build_object(
    'source', 'User-provided 星辰潛者.blend',
    'model', '/assets/pets/star-diver.glb',
    'thumbnail', '/assets/pets/star-diver-thumbnail.webp',
    'animation', 'Armature|mixamo.com|Layer0',
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + WebP textures',
    'triangleCount', 64030,
    'modelBytes', 733804
  )
),
(
  'pet',
  '泰迪酥',
  '帶著暖暖麵包香、用輕快步伐陪你探索冒險世界的機器夥伴。',
  18,
  'pet.teddy-sou',
  '/assets/pets/teddy-sou-thumbnail.webp',
  true,
  false,
  false,
  0.38,
  0.8,
  1.2,
  33,
  jsonb_build_object(
    'source', 'User-provided 泰迪酥.fbx',
    'model', '/assets/pets/teddy-sou.glb',
    'thumbnail', '/assets/pets/teddy-sou-thumbnail.webp',
    'animation', 'Armature|mixamo.com|Layer0',
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + WebP textures',
    'triangleCount', 81133,
    'modelBytes', 893124
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
