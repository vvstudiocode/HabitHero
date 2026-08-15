-- Keep all authored walk clips in place because world steering owns movement.
-- Also retire Teddy Sou safely: historical purchases and owned inventory are
-- auditable, so referenced catalog rows are hidden instead of hard-deleted.

begin;

update public.child_game_loadouts loadout
set following_pet_inventory_id = null,
    updated_at = timezone('utc', now())
where following_pet_inventory_id in (
  select inventory.id
  from public.child_inventory_items inventory
  join public.game_catalog_items item on item.id = inventory.catalog_item_id
  where item.item_type = 'pet'
    and item.asset_key = 'pet.teddy-sou'
);

update public.child_game_loadouts loadout
set following_pet_inventory_ids = array(
      select following_id
      from unnest(coalesce(loadout.following_pet_inventory_ids, '{}'::uuid[])) as following_id
      where not exists (
        select 1
        from public.child_inventory_items inventory
        join public.game_catalog_items item on item.id = inventory.catalog_item_id
        where inventory.id = following_id
          and item.item_type = 'pet'
          and item.asset_key = 'pet.teddy-sou'
      )
    ),
    updated_at = timezone('utc', now())
where exists (
  select 1
  from unnest(coalesce(loadout.following_pet_inventory_ids, '{}'::uuid[])) as following_id
  join public.child_inventory_items inventory on inventory.id = following_id
  join public.game_catalog_items item on item.id = inventory.catalog_item_id
  where item.item_type = 'pet'
    and item.asset_key = 'pet.teddy-sou'
);

update public.child_world_entities entity
set is_active = false,
    behavior_mode = 'idle',
    roaming_slot = null,
    updated_at = timezone('utc', now())
where entity.entity_kind = 'pet'
  and entity.inventory_item_id in (
    select inventory.id
    from public.child_inventory_items inventory
    join public.game_catalog_items item on item.id = inventory.catalog_item_id
    where item.item_type = 'pet'
      and item.asset_key = 'pet.teddy-sou'
  );

update public.game_catalog_items
set is_active = false,
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.teddy-sou';

delete from public.game_catalog_items item
where item.item_type = 'pet'
  and item.asset_key = 'pet.teddy-sou'
  and not exists (
    select 1 from public.family_game_item_prices price
    where price.catalog_item_id = item.id
  )
  and not exists (
    select 1 from public.game_item_purchases purchase
    where purchase.catalog_item_id = item.id
  )
  and not exists (
    select 1 from public.child_inventory_items inventory
    where inventory.catalog_item_id = item.id
  );

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'animation', 'Walk_InPlace',
      'idleAnimation', 'Idle',
      'animationStates', jsonb_build_array('idle', 'walk'),
      'rootMotion', 'in-place'
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.star-diver';

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'animation', 'Walk_InPlace',
      'idleAnimation', 'Idle',
      'animationStates', jsonb_build_array('idle', 'walk'),
      'visualScaleMultiplier', 3,
      'movementSpeedMultiplier', 0.5,
      'groundShadowScaleMultiplier', 0.33,
      'nameLabelScaleMultiplier', 0.33,
      'idlePauseSeconds', 10,
      'rootMotion', 'in-place',
      'modelBytes', 1392288
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.nibus';

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values (
  'pet',
  '克里斯多',
  '由璀璨晶石凝聚而成，帶著溫柔星光陪你探索冒險世界。',
  18,
  'pet.christo',
  '/assets/pets/christo-thumbnail.png',
  true,
  false,
  false,
  0.34,
  0.8,
  1.2,
  36,
  jsonb_build_object(
    'source', 'User-provided 克里斯多.fbx + 克里斯多idle.fbx',
    'model', '/assets/pets/christo.glb',
    'thumbnail', '/assets/pets/christo-thumbnail.png',
    'animation', 'Walk_InPlace',
    'idleAnimation', 'Idle',
    'animationStates', jsonb_build_array('idle', 'walk'),
    'renderMode', 'animated-glb',
    'compression', 'Draco mesh compression + 1024px WebP texture',
    'rootMotion', 'in-place',
    'triangleCount', 137576,
    'modelBytes', 1241868
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
