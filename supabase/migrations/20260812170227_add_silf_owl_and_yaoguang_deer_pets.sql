-- Add the user-provided Silf owl and Yaoguang deer as animated pets.
-- Store no shop thumbnail yet; the owner will provide the final transparent
-- shop images separately. The GLBs are shipped from public/assets/pets.

begin;

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values
(
  'pet',
  '希爾芙',
  '披著森林羽色、陪你安靜探索世界的貓頭鷹夥伴。',
  10,
  'pet.silf-owl',
  null,
  true,
  false,
  false,
  0.3,
  0.8,
  1.2,
  25,
  jsonb_build_object(
    'source', 'User-provided 希爾芙貓頭鷹_骨架.blend',
    'model', '/assets/pets/silf-owl.glb',
    'animation', 'Walk_Cycle',
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh + WebP textures',
    'thumbnailPending', true
  )
),
(
  'pet',
  '瑤光',
  '鹿角綴著葉與花、陪你輕盈漫步的四足夥伴。',
  12,
  'pet.yaoguang-deer',
  null,
  true,
  false,
  false,
  0.34,
  0.8,
  1.2,
  26,
  jsonb_build_object(
    'source', 'User-provided 瑤光鹿_四足走路骨架.blend',
    'model', '/assets/pets/yaoguang-deer.glb',
    'animation', 'Walk_InPlace',
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh + WebP textures',
    'thumbnailPending', true
  )
)
on conflict (item_type, asset_key) do update
set name = excluded.name,
    description = excluded.description,
    scroll_price = excluded.scroll_price,
    thumbnail_url = coalesce(public.game_catalog_items.thumbnail_url, excluded.thumbnail_url),
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
