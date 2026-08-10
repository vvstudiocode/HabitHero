-- Add the four user-provided Animal Plushies as fixed, non-stackable pets.
-- The model and thumbnail files are shipped with the web app under public/;
-- asset_key remains the stable catalog identity used by game state.

update public.game_catalog_items
set thumbnail_url = '/assets/animal-plushies/forest-fox-thumbnail.svg',
    updated_at = timezone('utc', now())
where item_type = 'pet' and asset_key = 'pet.forest-fox';

update public.game_catalog_items
set thumbnail_url = '/assets/animal-plushies/cloud-bird-thumbnail.svg',
    updated_at = timezone('utc', now())
where item_type = 'pet' and asset_key = 'pet.cloud-bird';

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values
  (
    'pet', '棕熊玩偶', '柔軟可靠的棕熊玩偶夥伴。', 6, 'pet.plush-bear',
    '/assets/animal-plushies/bear-thumbnail.png', true, false, false,
    0.34, 0.75, 1.35, 32,
    '{"source":"User-provided Animal Plushies Unity package","model":"/assets/animal-plushies/Bear.fbx","thumbnail":"/assets/animal-plushies/bear-thumbnail.png","primitive":"animal-plushie"}'::jsonb
  ),
  (
    'pet', '兔兔玩偶', '輕巧可愛的兔兔玩偶夥伴。', 6, 'pet.plush-bunny',
    '/assets/animal-plushies/bunny-thumbnail.png', true, false, false,
    0.3, 0.75, 1.35, 34,
    '{"source":"User-provided Animal Plushies Unity package","model":"/assets/animal-plushies/Bunny.fbx","thumbnail":"/assets/animal-plushies/bunny-thumbnail.png","primitive":"animal-plushie"}'::jsonb
  ),
  (
    'pet', '黑貓玩偶', '安靜陪伴冒險的黑貓玩偶。', 7, 'pet.plush-cat',
    '/assets/animal-plushies/cat-thumbnail.png', true, false, false,
    0.3, 0.75, 1.35, 36,
    '{"source":"User-provided Animal Plushies Unity package","model":"/assets/animal-plushies/Cat.fbx","thumbnail":"/assets/animal-plushies/cat-thumbnail.png","primitive":"animal-plushie"}'::jsonb
  ),
  (
    'pet', '小狗玩偶', '充滿活力的小狗玩偶夥伴。', 7, 'pet.plush-dog',
    '/assets/animal-plushies/dog-thumbnail.png', true, false, false,
    0.32, 0.75, 1.35, 38,
    '{"source":"User-provided Animal Plushies Unity package","model":"/assets/animal-plushies/Dog.fbx","thumbnail":"/assets/animal-plushies/dog-thumbnail.png","primitive":"animal-plushie"}'::jsonb
  )
on conflict (item_type, asset_key) do update
set name = excluded.name,
    description = excluded.description,
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
