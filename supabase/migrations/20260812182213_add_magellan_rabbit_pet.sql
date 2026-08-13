-- Add the user-provided Magellan Rabbit as a compact animated pet.
-- The shipped GLB uses Draco geometry compression and WebP textures.

begin;

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values (
  'pet',
  '麥哲倫',
  '背著旅行行囊、用輕快步伐陪你探索冒險世界的旅行兔夥伴。',
  13,
  'pet.magellan-rabbit',
  '/assets/pets/magellan-rabbit-thumbnail.png',
  true,
  false,
  false,
  0.32,
  0.8,
  1.2,
  28,
  jsonb_build_object(
    'source', 'User-provided 麥哲倫旅行兔_腿部調整_只動腳.blend',
    'model', '/assets/pets/magellan-rabbit.glb',
    'thumbnail', '/assets/pets/magellan-rabbit-thumbnail.png',
    'animation', 'Rabbit_Leg_Walk_Only',
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + WebP textures'
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
