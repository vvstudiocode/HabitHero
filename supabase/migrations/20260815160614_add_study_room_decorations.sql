-- Replace the starter primitive decorations with the supplied study-room set.
-- Retire the old rows instead of deleting them so any future historical
-- inventory or purchase references remain resolvable.
update public.game_catalog_items
set is_active = false,
    updated_at = timezone('utc', now())
where item_type = 'decoration'
  and asset_key in (
    'decoration.flower-lantern',
    'decoration.mushroom-stool',
    'decoration.adventure-flag'
  );

insert into public.game_catalog_items (
  item_type,
  name,
  description,
  scroll_price,
  asset_key,
  thumbnail_url,
  is_active,
  is_starter,
  is_stackable,
  collision_radius,
  min_scale,
  max_scale,
  sort_order,
  metadata
)
values
  (
    'decoration',
    '木製書桌',
    '放在世界裡就能開始寫下冒險故事的溫暖書桌。',
    6,
    'decoration.study-desk',
    '/assets/decorations/study-desk-thumbnail.png',
    true,
    false,
    true,
    0.95,
    0.25,
    0.8,
    40,
    jsonb_build_object(
      'model', '/assets/decorations/study-desk.glb',
      'thumbnail', '/assets/decorations/study-desk-thumbnail.png',
      'renderMode', 'static-glb',
      'defaultScale', 0.62,
      'groundOffset', 0.713,
      'compression', 'Draco geometry + WebP textures + 50% mesh simplification'
    )
  ),
  (
    'decoration',
    '木製書櫃',
    '把完成任務換來的故事與小秘密，整齊收藏在書櫃裡。',
    7,
    'decoration.bookcase',
    '/assets/decorations/bookcase-thumbnail.png',
    true,
    false,
    true,
    0.85,
    0.25,
    0.65,
    50,
    jsonb_build_object(
      'model', '/assets/decorations/bookcase.glb',
      'thumbnail', '/assets/decorations/bookcase-thumbnail.png',
      'renderMode', 'static-glb',
      'defaultScale', 0.4,
      'groundOffset', 1,
      'compression', 'Draco geometry + WebP textures + 50% mesh simplification'
    )
  ),
  (
    'decoration',
    '木製椅子',
    '一張舒服的小椅子，適合在冒險途中休息一下。',
    5,
    'decoration.study-chair',
    '/assets/decorations/study-chair-thumbnail.png',
    true,
    false,
    true,
    0.65,
    0.25,
    0.65,
    60,
    jsonb_build_object(
      'model', '/assets/decorations/study-chair.glb',
      'thumbnail', '/assets/decorations/study-chair-thumbnail.png',
      'renderMode', 'static-glb',
      'defaultScale', 0.36,
      'groundOffset', 1,
      'compression', 'Draco geometry + WebP textures + 50% mesh simplification'
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
;
