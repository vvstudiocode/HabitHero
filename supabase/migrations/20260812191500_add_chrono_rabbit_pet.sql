-- Add the user-provided animated Chrono rabbit to the pet shop.
-- The GLB uses WebP textures plus Draco mesh compression to keep the download small.

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values (
  'pet',
  '克羅諾',
  '帶著月光懷錶、陪你穿梭冒險時光的兔子夥伴。',
  10,
  'pet.chrono-rabbit',
  '/assets/pets/chrono-rabbit-thumbnail.png',
  true,
  false,
  false,
  0.3,
  0.8,
  1.2,
  24,
  jsonb_build_object(
    'source', 'User-provided 兔子.blend',
    'model', '/assets/pets/chrono-rabbit.glb',
    'thumbnail', '/assets/pets/chrono-rabbit-thumbnail.png',
    'animation', 'Rabbit_Walk_Cycle',
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh + WebP textures'
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
