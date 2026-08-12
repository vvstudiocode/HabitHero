-- Replace every previous pet family with the supplied animated Starlight
-- Sprout GLB. Pet purchases are intentionally removed with their purchase
-- ledger entries because the old pixel/plush catalog is no longer offered.

begin;

update public.child_game_loadouts loadout
set following_pet_inventory_id = null,
    updated_at = timezone('utc', now())
where following_pet_inventory_id is not null
  and exists (
    select 1
    from public.child_inventory_items inventory
    join public.game_catalog_items item on item.id = inventory.catalog_item_id
    where inventory.id = loadout.following_pet_inventory_id
      and item.item_type = 'pet'
  );

update public.child_world_states state
set revision = state.revision + 1,
    updated_at = timezone('utc', now())
where exists (
  select 1
  from public.child_world_entities entity
  join public.child_inventory_items inventory on inventory.id = entity.inventory_item_id
  join public.game_catalog_items item on item.id = inventory.catalog_item_id
  where entity.child_profile_id = state.child_profile_id
    and entity.entity_kind = 'pet'
    and item.item_type = 'pet'
);

delete from public.child_world_entities entity
using public.child_inventory_items inventory, public.game_catalog_items item
where entity.inventory_item_id = inventory.id
  and inventory.catalog_item_id = item.id
  and item.item_type = 'pet';

delete from public.game_currency_ledger ledger
using public.game_item_purchases purchase, public.game_catalog_items item
where ledger.source_purchase_id = purchase.id
  and purchase.catalog_item_id = item.id
  and item.item_type = 'pet';

delete from public.game_item_purchases purchase
using public.game_catalog_items item
where purchase.catalog_item_id = item.id
  and item.item_type = 'pet';

delete from public.family_game_item_prices price
using public.game_catalog_items item
where price.catalog_item_id = item.id
  and item.item_type = 'pet';

delete from public.child_inventory_items inventory
using public.game_catalog_items item
where inventory.catalog_item_id = item.id
  and item.item_type = 'pet';

delete from public.game_catalog_items
where item_type = 'pet';

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, thumbnail_url,
  is_active, is_starter, is_stackable, collision_radius, min_scale, max_scale,
  sort_order, metadata
) values (
  'pet',
  '星芽木偶',
  '會用輕快步伐陪你探索冒險世界的星芽木偶。',
  8,
  'pet.starlight-sprout',
  null,
  true,
  false,
  false,
  0.34,
  0.85,
  1.15,
  20,
  jsonb_build_object(
    'source', 'User-provided Meshy Starlight Sprout biped GLB',
    'model', '/assets/starlight-sprout-pet.glb',
    'animation', 'Armature|walking_man|baselayer',
    'renderMode', 'animated-glb'
  )
);

commit;
