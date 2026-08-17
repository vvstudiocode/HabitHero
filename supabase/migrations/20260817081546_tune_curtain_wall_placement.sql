-- Decoration-to-decoration overlap is allowed. Keep a smaller positive
-- navigation proxy so the player can approach the visible furniture without
-- walking through it. Non-decoration entities do not use this exemption.

update public.game_catalog_items
set
  collision_radius = case asset_key
    when 'decoration.curtain-wall' then 0.280
    when 'decoration.wall' then 0.280
    else collision_radius
  end,
  max_scale = case
    when asset_key in ('decoration.curtain-wall', 'decoration.wall') then 1.25
    else max_scale
  end,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'navigationRadius', case asset_key
      when 'decoration.study-desk' then 0.580
      when 'decoration.bookcase' then 0.480
      when 'decoration.study-chair' then 0.360
      when 'decoration.bed' then 0.560
      when 'decoration.nightstand' then 0.320
      when 'decoration.adventure-table' then 0.480
      when 'decoration.fountain' then 0.400
      when 'decoration.curtain-wall' then 0.280
      when 'decoration.wall' then 0.280
      else collision_radius
    end,
    'allowDecorationOverlap', true
  ),
  updated_at = timezone('utc', now())
where item_type = 'decoration'
  and is_active
  and asset_key in (
    'decoration.study-desk',
    'decoration.bookcase',
    'decoration.study-chair',
    'decoration.bed',
    'decoration.nightstand',
    'decoration.adventure-table',
    'decoration.fountain',
    'decoration.curtain-wall',
    'decoration.wall'
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
values (
  'decoration',
  '牆壁',
  '簡潔溫暖的木製牆面，替世界搭出一個舒服的小角落。',
  6,
  'decoration.wall',
  '/assets/decorations/wall-thumbnail.webp',
  true,
  false,
  true,
  0.280,
  0.25,
  1.25,
  120,
  jsonb_build_object(
    'model', '/assets/decorations/wall.glb',
    'thumbnail', '/assets/decorations/wall-thumbnail.webp',
    'renderMode', 'static-glb',
    'defaultScale', 0.58,
    'groundOffset', 0.6309,
    'navigationRadius', 0.280,
    'allowDecorationOverlap', true,
    'triangleCount', 25605,
    'textureSize', 1024,
    'simplificationRatio', 0.25,
    'compression', 'Draco geometry + WebP textures + mesh simplification'
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

create or replace function private.validate_world_transform(
  target_child_profile_id uuid,
  target_entity_id uuid,
  target_entity_kind text,
  target_position_x numeric,
  target_position_y numeric,
  target_position_z numeric,
  target_scale numeric,
  target_collision_radius numeric,
  target_min_scale numeric,
  target_max_scale numeric
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  effective_radius numeric := target_collision_radius * target_scale;
begin
  if target_position_x is null or target_position_y is null or target_position_z is null
     or target_scale is null
     or not (target_position_x between -5 and 5)
     or not (target_position_y between -2 and 5)
     or not (target_position_z between -5 and 5)
     or target_scale < greatest(0.1, target_min_scale)
     or target_scale > least(3, target_max_scale)
     or effective_radius <= 0
     or abs(target_position_x) + effective_radius > 4.8
     or abs(target_position_z) + effective_radius > 4.8 then
    raise exception 'world transform is outside the playable area' using errcode = '22023';
  end if;
  if target_entity_kind = 'decoration'
     and (sqrt(power(target_position_x, 2) + power(target_position_z - 2.2, 2)) < effective_radius + 0.8 + 0.02
       or sqrt(power(target_position_x, 2) + power(target_position_z, 2)) < effective_radius + 1.15 + 0.02) then
    raise exception 'world transform is inside a protected area' using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.validate_world_transform(
  uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric
) from public, anon, authenticated;
