-- Add the user-provided Buleifu tiger and Belilos fox as compact animated pets.
-- The shipped GLBs use Draco geometry compression and WebP textures; the
-- transparent WebP thumbnails keep the shop payload small on mobile.

begin;

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values
(
  'pet',
  '布雷夫虎',
  '披著赤金鬃毛、守護你勇敢探索冒險世界的虎夥伴。',
  15,
  'pet.buleifu-tiger',
  '/assets/pets/buleifu-tiger-thumbnail.webp',
  true,
  false,
  false,
  0.38,
  0.8,
  1.2,
  29,
  jsonb_build_object(
    'source', 'User-provided 布雷夫虎正確.blend',
    'model', '/assets/pets/buleifu-tiger.glb',
    'thumbnail', '/assets/pets/buleifu-tiger-thumbnail.webp',
    'animation', 'Walk_Cycle_Demo',
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + WebP textures',
    'triangleCount', 80338,
    'modelBytes', 688488
  )
),
(
  'pet',
  '貝里洛斯狐狸',
  '帶著森林羽飾、用靈巧步伐陪你探索冒險世界的狐狸夥伴。',
  16,
  'pet.belilos-fox',
  '/assets/pets/belilos-fox-thumbnail.webp',
  true,
  false,
  false,
  0.34,
  0.8,
  1.2,
  30,
  jsonb_build_object(
    'source', 'User-provided 貝里洛斯狐狸正確.blend',
    'model', '/assets/pets/belilos-fox.glb',
    'thumbnail', '/assets/pets/belilos-fox-thumbnail.webp',
    'animation', '貝里洛斯狐狸_Walk_Forward',
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + WebP textures',
    'triangleCount', 101184,
    'modelBytes', 1594512
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
