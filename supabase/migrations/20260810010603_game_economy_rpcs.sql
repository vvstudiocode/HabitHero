-- Game economy RPCs. Every write path derives family/child ownership from the
-- authenticated session and performs its accounting or world mutation in one
-- database transaction.

create or replace function private.resolve_game_child(target_child_profile_id uuid default null)
returns public.child_profiles
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  child_row public.child_profiles;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if target_child_profile_id is null then
    select * into child_row from public.child_profiles
     where profile_id = (select auth.uid())
     limit 1;
  else
    select * into child_row from public.child_profiles where id = target_child_profile_id;
  end if;
  if not found or not (
    private.is_child_owner(child_row.family_id, child_row.id)
    or private.is_family_parent(child_row.family_id)
  ) then
    raise exception 'child not found or not authorized' using errcode = '42501';
  end if;
  return child_row;
end;
$$;

create or replace function private.validate_world_transform(
  target_child_profile_id uuid,
  target_entity_id uuid,
  target_entity_kind text,
  position_x numeric,
  position_y numeric,
  position_z numeric,
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
  if position_x is null or position_y is null or position_z is null
     or target_scale is null
     or not (position_x between -5 and 5)
     or not (position_y between -2 and 5)
     or not (position_z between -5 and 5)
     or target_scale < greatest(0.25, target_min_scale)
     or target_scale > least(3, target_max_scale)
     or effective_radius <= 0
     or abs(position_x) + effective_radius > 4.8
     or abs(position_z) + effective_radius > 4.8 then
    raise exception 'world transform is outside the playable area' using errcode = '22023';
  end if;
  if target_entity_kind = 'decoration'
     and (sqrt(power(position_x, 2) + power(position_z - 2.2, 2)) < effective_radius + 0.8 + 0.02
       or sqrt(power(position_x, 2) + power(position_z, 2)) < effective_radius + 1.15 + 0.02) then
    raise exception 'world transform is inside a protected area' using errcode = '22023';
  end if;
  if target_entity_kind = 'decoration' and exists (
    select 1
      from public.child_world_entities entity
      join public.child_inventory_items inventory on inventory.id = entity.inventory_item_id
      join public.game_catalog_items item on item.id = inventory.catalog_item_id
     where entity.child_profile_id = target_child_profile_id
       and entity.is_active
       and entity.entity_kind = 'decoration'
       and entity.id is distinct from target_entity_id
       and sqrt(power(entity.position_x - position_x, 2) + power(entity.position_z - position_z, 2))
           < (item.collision_radius * entity.scale) + effective_radius + 0.02
  ) then
    raise exception 'decorations cannot overlap' using errcode = '23P01';
  end if;
end;
$$;

create or replace function public.purchase_game_item(
  target_catalog_item_id uuid,
  target_quantity integer,
  purchase_idempotency_key uuid,
  target_child_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  child_row public.child_profiles;
  catalog_row public.game_catalog_items;
  wallet_row public.child_game_wallets;
  inventory_row public.child_inventory_items;
  purchase_row public.game_item_purchases;
  unit_price integer;
  total_price bigint;
  family_override integer;
  inventory_found boolean := false;
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  if target_quantity is null or target_quantity <= 0 or purchase_idempotency_key is null then
    raise exception 'purchase details are invalid' using errcode = '22023';
  end if;

  insert into public.child_game_wallets (family_id, child_profile_id)
  values (child_row.family_id, child_row.id)
  on conflict (child_profile_id) do nothing;
  select * into wallet_row from public.child_game_wallets
   where child_profile_id = child_row.id for update;

  select * into purchase_row from public.game_item_purchases
   where child_profile_id = child_row.id and idempotency_key = purchase_idempotency_key;
  if found then
    select * into inventory_row from public.child_inventory_items
     where child_profile_id = child_row.id
       and catalog_item_id = purchase_row.catalog_item_id;
    return jsonb_build_object(
      'purchase_id', purchase_row.id,
      'wallet_balance', wallet_row.scroll_balance,
      'inventory_item_id', inventory_row.id,
      'quantity', inventory_row.quantity,
      'idempotent_replay', true
    );
  end if;

  select * into catalog_row from public.game_catalog_items
   where id = target_catalog_item_id for update;
  if not found or not catalog_row.is_active or catalog_row.is_starter then
    raise exception 'catalog item is not purchasable' using errcode = '22023';
  end if;
  if not catalog_row.is_stackable and target_quantity <> 1 then
    raise exception 'this item cannot be purchased in a quantity' using errcode = '22023';
  end if;
  select scroll_price into family_override from public.family_game_item_prices
   where family_id = child_row.family_id and catalog_item_id = catalog_row.id;
  unit_price := coalesce(family_override, catalog_row.scroll_price);
  if unit_price < 1 then
    raise exception 'catalog price is invalid' using errcode = '22023';
  end if;
  total_price := unit_price::bigint * target_quantity::bigint;
  if wallet_row.scroll_balance < total_price then
    raise exception 'insufficient quest scrolls' using errcode = '22003';
  end if;

  select * into inventory_row from public.child_inventory_items
   where child_profile_id = child_row.id and catalog_item_id = catalog_row.id for update;
  inventory_found := found;
  if inventory_found and not catalog_row.is_stackable then
    raise exception 'item is already owned' using errcode = '23505';
  end if;

  insert into public.game_item_purchases (
    family_id, child_profile_id, catalog_item_id, idempotency_key,
    quantity, unit_price, total_price, catalog_name_snapshot, catalog_type_snapshot
  ) values (
    child_row.family_id, child_row.id, catalog_row.id, purchase_idempotency_key,
    target_quantity, unit_price, total_price, catalog_row.name, catalog_row.item_type
  ) returning * into purchase_row;

  update public.child_game_wallets
     set scroll_balance = scroll_balance - total_price
   where child_profile_id = child_row.id
   returning * into wallet_row;
  insert into public.game_currency_ledger (
    family_id, child_profile_id, entry_type, amount_delta, source_purchase_id, note
  ) values (
    child_row.family_id, child_row.id, 'purchase', -total_price, purchase_row.id, 'game item purchase'
  );

  if inventory_found then
    update public.child_inventory_items
       set quantity = quantity + target_quantity
     where id = inventory_row.id
     returning * into inventory_row;
  else
    insert into public.child_inventory_items (
      family_id, child_profile_id, catalog_item_id, quantity, acquired_via
    ) values (
      child_row.family_id, child_row.id, catalog_row.id, target_quantity, 'purchase'
    ) returning * into inventory_row;
  end if;

  return jsonb_build_object(
    'purchase_id', purchase_row.id,
    'wallet_balance', wallet_row.scroll_balance,
    'inventory_item_id', inventory_row.id,
    'quantity', inventory_row.quantity,
    'idempotent_replay', false
  );
end;
$$;

create or replace function public.set_family_game_item_price(
  target_catalog_item_id uuid,
  target_scroll_price integer
)
returns public.family_game_item_prices
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_family_id uuid;
  catalog_row public.game_catalog_items;
  price_row public.family_game_item_prices;
begin
  if (select auth.uid()) is null or target_scroll_price is null or target_scroll_price < 1 then
    raise exception 'price is invalid' using errcode = '22023';
  end if;
  select fm.family_id into v_family_id from public.family_members as fm
   where fm.profile_id = (select auth.uid()) and fm.role = 'parent' limit 1;
  if v_family_id is null then
    raise exception 'family not found or not authorized' using errcode = '42501';
  end if;
  select * into catalog_row from public.game_catalog_items where id = target_catalog_item_id;
  if not found or catalog_row.is_starter or not catalog_row.is_active then
    raise exception 'starter or inactive items cannot be priced' using errcode = '22023';
  end if;
  insert into public.family_game_item_prices (family_id, catalog_item_id, scroll_price, updated_by)
  values (v_family_id, target_catalog_item_id, target_scroll_price, (select auth.uid()))
  on conflict (family_id, catalog_item_id) do update
    set scroll_price = excluded.scroll_price, updated_by = excluded.updated_by
  returning * into price_row;
  return price_row;
end;
$$;

create or replace function public.reset_family_game_item_price(target_catalog_item_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_family_id uuid;
begin
  select fm.family_id into v_family_id from public.family_members as fm
   where fm.profile_id = (select auth.uid()) and fm.role = 'parent' limit 1;
  if v_family_id is null then raise exception 'family not found or not authorized' using errcode = '42501'; end if;
  delete from public.family_game_item_prices
   where public.family_game_item_prices.family_id = v_family_id
     and public.family_game_item_prices.catalog_item_id = target_catalog_item_id;
end;
$$;

create or replace function public.equip_game_character(
  target_inventory_item_id uuid,
  target_child_profile_id uuid default null
)
returns public.child_game_loadouts
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  child_row public.child_profiles;
  inventory_row public.child_inventory_items;
  loadout_row public.child_game_loadouts;
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  select inventory.* into inventory_row
    from public.child_inventory_items inventory
    join public.game_catalog_items item on item.id = inventory.catalog_item_id
   where inventory.id = target_inventory_item_id
     and inventory.child_profile_id = child_row.id
     and item.item_type = 'character';
  if not found then raise exception 'character is not owned by this child' using errcode = '42501'; end if;
  insert into public.child_game_loadouts (family_id, child_profile_id, equipped_character_inventory_id)
  values (child_row.family_id, child_row.id, inventory_row.id)
  on conflict (child_profile_id) do update
    set equipped_character_inventory_id = excluded.equipped_character_inventory_id;
  select * into loadout_row from public.child_game_loadouts where child_profile_id = child_row.id;
  return loadout_row;
end;
$$;

create or replace function public.set_following_pet(
  target_inventory_item_id uuid default null,
  target_child_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  child_row public.child_profiles;
  inventory_row public.child_inventory_items;
  world_state public.child_world_states;
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  insert into public.child_world_states (family_id, child_profile_id)
  values (child_row.family_id, child_row.id)
  on conflict (child_profile_id) do nothing;
  select * into world_state
    from public.child_world_states
   where child_profile_id = child_row.id
   for update;
  if target_inventory_item_id is not null then
    select inventory.* into inventory_row
      from public.child_inventory_items inventory
      join public.game_catalog_items item on item.id = inventory.catalog_item_id
     where inventory.id = target_inventory_item_id
       and inventory.child_profile_id = child_row.id
       and item.item_type = 'pet';
    if not found then raise exception 'pet is not owned by this child' using errcode = '42501'; end if;
    update public.child_world_entities
       set is_active = false, roaming_slot = null, behavior_mode = 'idle'
     where child_profile_id = child_row.id
       and inventory_item_id = target_inventory_item_id
       and behavior_mode = 'wander';
    if found then
      update public.child_world_states
         set revision = revision + 1
       where child_profile_id = child_row.id
       returning * into world_state;
    end if;
  end if;
  insert into public.child_game_loadouts (family_id, child_profile_id, following_pet_inventory_id)
  values (child_row.family_id, child_row.id, target_inventory_item_id)
  on conflict (child_profile_id) do update
    set following_pet_inventory_id = excluded.following_pet_inventory_id;
  return jsonb_build_object('revision', world_state.revision);
end;
$$;

create or replace function public.set_roaming_pets(
  target_inventory_item_ids uuid[],
  target_child_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  child_row public.child_profiles;
  loadout_row public.child_game_loadouts;
  inventory_row public.child_inventory_items;
  selected_id uuid;
  slot smallint;
  world_state public.child_world_states;
  entity_row public.child_world_entities;
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  if target_inventory_item_ids is null or cardinality(target_inventory_item_ids) > 3 then
    raise exception 'at most three roaming pets are allowed' using errcode = '22023';
  end if;
  insert into public.child_game_loadouts (family_id, child_profile_id)
  values (child_row.family_id, child_row.id)
  on conflict (child_profile_id) do nothing;
  select * into loadout_row from public.child_game_loadouts where child_profile_id = child_row.id for update;
  if loadout_row.following_pet_inventory_id = any(coalesce(target_inventory_item_ids, array[]::uuid[])) then
    raise exception 'following pet cannot also roam' using errcode = '23514';
  end if;
  insert into public.child_world_states (family_id, child_profile_id)
  values (child_row.family_id, child_row.id)
  on conflict (child_profile_id) do nothing;
  select * into world_state from public.child_world_states where child_profile_id = child_row.id for update;
  update public.child_world_entities
     set behavior_mode = 'idle', roaming_slot = null, is_active = false
   where child_profile_id = child_row.id and entity_kind = 'pet' and is_active;

  for selected_id, slot in
    select roaming_item.value, roaming_item.ordinal::smallint
      from unnest(coalesce(target_inventory_item_ids, array[]::uuid[])) with ordinality as roaming_item(value, ordinal)
  loop
    select inventory.* into inventory_row
      from public.child_inventory_items inventory
      join public.game_catalog_items item on item.id = inventory.catalog_item_id
     where inventory.id = selected_id and inventory.child_profile_id = child_row.id and item.item_type = 'pet';
    if not found then raise exception 'roaming pet is not owned by this child' using errcode = '42501'; end if;
    select * into entity_row from public.child_world_entities
     where child_profile_id = child_row.id and inventory_item_id = selected_id and entity_kind = 'pet'
     order by updated_at desc limit 1 for update;
    if found then
      update public.child_world_entities
         set behavior_mode = 'wander', roaming_slot = slot, is_active = true,
             position_x = -2.0 + (slot - 1) * 1.5, position_y = 0, position_z = -2.0
       where id = entity_row.id;
    else
      insert into public.child_world_entities (
        family_id, child_profile_id, inventory_item_id, entity_kind,
        position_x, position_y, position_z, behavior_mode, roaming_slot, is_active
      ) values (
        child_row.family_id, child_row.id, selected_id, 'pet',
        -2.0 + (slot - 1) * 1.5, 0, -2.0, 'wander', slot, true
      );
    end if;
  end loop;
  update public.child_world_entities
     set behavior_mode = 'idle', roaming_slot = null, is_active = false
   where child_profile_id = child_row.id
     and entity_kind = 'pet'
     and inventory_item_id <> all(coalesce(target_inventory_item_ids, array[]::uuid[]));
  update public.child_world_states set revision = revision + 1 where child_profile_id = child_row.id returning * into world_state;
  return jsonb_build_object('revision', world_state.revision);
end;
$$;

create or replace function public.place_world_entity(
  target_inventory_item_id uuid,
  expected_revision bigint,
  position_x numeric,
  position_y numeric,
  position_z numeric,
  rotation_x numeric,
  rotation_y numeric,
  rotation_z numeric,
  target_scale numeric,
  target_behavior_mode text default 'static',
  target_roaming_slot smallint default null,
  target_child_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  child_row public.child_profiles;
  inventory_row public.child_inventory_items;
  catalog_row public.game_catalog_items;
  loadout_row public.child_game_loadouts;
  world_state public.child_world_states;
  entity_row public.child_world_entities;
  entity_kind text;
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  insert into public.child_world_states (family_id, child_profile_id) values (child_row.family_id, child_row.id) on conflict do nothing;
  select * into world_state from public.child_world_states where child_profile_id = child_row.id for update;
  if expected_revision is null or expected_revision <> world_state.revision then raise exception 'world revision conflict' using errcode = '40001'; end if;
  select inventory.* into inventory_row from public.child_inventory_items inventory
   where inventory.id = target_inventory_item_id and inventory.child_profile_id = child_row.id;
  if not found then raise exception 'world inventory item not found' using errcode = '42501'; end if;
  select item.* into catalog_row from public.game_catalog_items item where item.id = inventory_row.catalog_item_id;
  if catalog_row.item_type = 'character' then
    raise exception 'characters cannot be placed as world entities' using errcode = '22023';
  end if;
  entity_kind := case when catalog_row.item_type = 'pet' then 'pet' else 'decoration' end;
  if target_behavior_mode not in ('static', 'idle', 'wander') or (entity_kind = 'decoration' and target_behavior_mode <> 'static')
     or (target_behavior_mode = 'wander' and target_roaming_slot not between 1 and 3)
     or (target_behavior_mode <> 'wander' and target_roaming_slot is not null) then
    raise exception 'world entity behavior is invalid' using errcode = '22023';
  end if;
  select * into loadout_row from public.child_game_loadouts where child_profile_id = child_row.id;
  if entity_kind = 'pet' and loadout_row.following_pet_inventory_id = target_inventory_item_id then
    raise exception 'following pet cannot be placed as a roaming pet' using errcode = '23514';
  end if;
  if entity_kind = 'decoration' then
    if (select count(*) from public.child_world_entities
        where child_profile_id = child_row.id and inventory_item_id = target_inventory_item_id and entity_kind = 'decoration' and is_active)
        >= inventory_row.quantity then
      raise exception 'all owned copies of this decoration are already placed' using errcode = '23505';
    end if;
  elsif exists (select 1 from public.child_world_entities where child_profile_id = child_row.id and inventory_item_id = target_inventory_item_id and is_active) then
    raise exception 'world entity is already placed' using errcode = '23505';
  end if;
  if target_behavior_mode = 'wander' and exists (
    select 1 from public.child_world_entities where child_profile_id = child_row.id and entity_kind = 'pet'
      and behavior_mode = 'wander' and is_active and roaming_slot = target_roaming_slot
  ) then raise exception 'roaming slot is already in use' using errcode = '23505'; end if;
  perform private.validate_world_transform(child_row.id, null, entity_kind, position_x, position_y, position_z, target_scale, catalog_row.collision_radius, catalog_row.min_scale, catalog_row.max_scale);
  insert into public.child_world_entities (
    family_id, child_profile_id, inventory_item_id, entity_kind, position_x, position_y, position_z,
    rotation_x, rotation_y, rotation_z, scale, behavior_mode, roaming_slot, is_active
  ) values (
    child_row.family_id, child_row.id, target_inventory_item_id, entity_kind, position_x, position_y, position_z,
    rotation_x, rotation_y, rotation_z, target_scale, target_behavior_mode, target_roaming_slot, true
  ) returning * into entity_row;
  update public.child_world_states set revision = revision + 1 where child_profile_id = child_row.id returning * into world_state;
  return jsonb_build_object('revision', world_state.revision, 'entity', to_jsonb(entity_row));
end;
$$;

create or replace function public.update_world_entity_transform(
  target_inventory_item_id uuid,
  expected_revision bigint,
  position_x numeric,
  position_y numeric,
  position_z numeric,
  rotation_x numeric,
  rotation_y numeric,
  rotation_z numeric,
  target_scale numeric,
  target_entity_id uuid default null,
  target_child_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  child_row public.child_profiles;
  entity_row public.child_world_entities;
  catalog_row public.game_catalog_items;
  world_state public.child_world_states;
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  select * into world_state from public.child_world_states where child_profile_id = child_row.id for update;
  if not found or expected_revision is null or expected_revision <> world_state.revision then raise exception 'world revision conflict' using errcode = '40001'; end if;
  select entity.* into entity_row from public.child_world_entities entity
   where entity.child_profile_id = child_row.id and entity.inventory_item_id = target_inventory_item_id
     and entity.is_active and (target_entity_id is null or entity.id = target_entity_id)
   order by entity.updated_at desc limit 1 for update;
  if not found then raise exception 'world entity not found' using errcode = '42501'; end if;
  select item.* into catalog_row from public.child_inventory_items inventory join public.game_catalog_items item on item.id = inventory.catalog_item_id where inventory.id = target_inventory_item_id;
  perform private.validate_world_transform(child_row.id, entity_row.id, entity_row.entity_kind, position_x, position_y, position_z, target_scale, catalog_row.collision_radius, catalog_row.min_scale, catalog_row.max_scale);
  update public.child_world_entities set position_x = update_world_entity_transform.position_x, position_y = update_world_entity_transform.position_y,
    position_z = update_world_entity_transform.position_z, rotation_x = update_world_entity_transform.rotation_x,
    rotation_y = update_world_entity_transform.rotation_y, rotation_z = update_world_entity_transform.rotation_z,
    scale = update_world_entity_transform.target_scale where id = entity_row.id returning * into entity_row;
  update public.child_world_states set revision = revision + 1 where child_profile_id = child_row.id returning * into world_state;
  return jsonb_build_object('revision', world_state.revision, 'entity', to_jsonb(entity_row));
end;
$$;

create or replace function public.remove_world_entity(
  target_inventory_item_id uuid,
  expected_revision bigint,
  target_entity_id uuid default null,
  target_child_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  child_row public.child_profiles;
  world_state public.child_world_states;
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  select * into world_state from public.child_world_states where child_profile_id = child_row.id for update;
  if not found or expected_revision is null or expected_revision <> world_state.revision then raise exception 'world revision conflict' using errcode = '40001'; end if;
  update public.child_world_entities set is_active = false, roaming_slot = null, behavior_mode = 'idle'
   where child_profile_id = child_row.id and inventory_item_id = target_inventory_item_id and is_active
     and (target_entity_id is null or id = target_entity_id);
  if not found then raise exception 'world entity not found' using errcode = '42501'; end if;
  update public.child_world_states set revision = revision + 1 where child_profile_id = child_row.id returning * into world_state;
  return jsonb_build_object('revision', world_state.revision);
end;
$$;

create or replace function public.collect_all_world_decorations(
  expected_revision bigint,
  target_child_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  child_row public.child_profiles;
  world_state public.child_world_states;
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  select * into world_state from public.child_world_states where child_profile_id = child_row.id for update;
  if not found or expected_revision is null or expected_revision <> world_state.revision then raise exception 'world revision conflict' using errcode = '40001'; end if;
  update public.child_world_entities set is_active = false where child_profile_id = child_row.id and entity_kind = 'decoration' and is_active;
  update public.child_world_states set revision = revision + 1 where child_profile_id = child_row.id returning * into world_state;
  return jsonb_build_object('revision', world_state.revision);
end;
$$;

create or replace function public.review_adventure_completion(
  target_task_id uuid,
  approved boolean,
  approved_points integer default null,
  feedback text default null,
  correction text default null,
  tone text default null,
  revision_note text default null
)
returns public.tasks
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  task_row public.tasks;
  child_row public.child_profiles;
  wallet_row public.child_game_wallets;
  points_to_award integer;
  normalized_feedback text := nullif(trim(feedback), '');
  normalized_correction text := nullif(trim(correction), '');
  normalized_revision_note text := nullif(trim(revision_note), '');
  normalized_tone text := nullif(trim(tone), '');
begin
  if (select auth.uid()) is null or approved is null then raise exception 'review decision is required' using errcode = '22023'; end if;
  if normalized_tone is not null and normalized_tone not in ('encouraging', 'coaching', 'corrective', 'celebratory') then raise exception 'feedback tone is invalid' using errcode = '22023'; end if;
  select * into task_row from public.tasks where id = target_task_id for update;
  if not found or not private.is_family_parent(task_row.family_id) then raise exception 'task not found or not authorized' using errcode = '42501'; end if;
  if task_row.status = 'completed' and approved then return task_row; end if;
  if task_row.status <> 'pending' then raise exception 'task is not pending review' using errcode = '22023'; end if;
  if not approved then
    if normalized_revision_note is null or char_length(normalized_revision_note) > 1000 then raise exception 'revision note is required' using errcode = '22023'; end if;
    update public.tasks set status = 'revision_requested', reviewed_at = timezone('utc', now()), reviewed_by = (select auth.uid()), approved_points = null,
      parent_feedback_text = normalized_feedback, parent_correction_text = normalized_correction, feedback_tone = normalized_tone, revision_note = normalized_revision_note
     where id = task_row.id returning * into task_row;
    return task_row;
  end if;

  points_to_award := coalesce(approved_points, task_row.points);
  if points_to_award < 0 then raise exception 'approved points must be nonnegative' using errcode = '22023'; end if;
  select * into child_row from public.child_profiles where id = task_row.child_profile_id for update;
  if points_to_award > 0 and not exists (select 1 from public.point_ledger where task_id = task_row.id and entry_type = 'task_approved') then
    insert into public.point_ledger (family_id, child_profile_id, task_id, entry_type, points_delta, note)
    values (task_row.family_id, task_row.child_profile_id, task_row.id, 'task_approved', points_to_award, coalesce(normalized_feedback, 'task approved'));
    update public.child_profiles set points_balance = points_balance + points_to_award where id = child_row.id;
  end if;
  insert into public.child_game_wallets (family_id, child_profile_id) values (task_row.family_id, task_row.child_profile_id) on conflict do nothing;
  select * into wallet_row from public.child_game_wallets where child_profile_id = task_row.child_profile_id for update;
  if not exists (select 1 from public.game_currency_ledger where source_task_id = task_row.id and entry_type = 'task_approved') then
    insert into public.game_currency_ledger (family_id, child_profile_id, entry_type, amount_delta, source_task_id, note)
    values (task_row.family_id, task_row.child_profile_id, 'task_approved', 1, task_row.id, 'approved adventure reward');
    update public.child_game_wallets set scroll_balance = scroll_balance + 1 where child_profile_id = task_row.child_profile_id;
  end if;
  update public.tasks set status = 'completed', reviewed_at = timezone('utc', now()), reviewed_by = (select auth.uid()), approved_points = points_to_award,
    parent_feedback_text = normalized_feedback, parent_correction_text = normalized_correction, feedback_tone = normalized_tone, revision_note = null
   where id = task_row.id returning * into task_row;
  return task_row;
end;
$$;

create or replace function public.review_task_completion(
  target_task_id uuid, approved boolean, approved_points integer, feedback text, correction text, tone text, revision_note text
)
returns public.tasks
language plpgsql security definer set search_path = pg_catalog, public, private
as $$ begin return public.review_adventure_completion(target_task_id, approved, approved_points, feedback, correction, tone, revision_note); end; $$;

create or replace function public.approve_task_completion(target_task_id uuid)
returns public.tasks
language plpgsql security definer set search_path = pg_catalog, public, private
as $$
declare task_row public.tasks; child_row public.child_profiles; wallet_row public.child_game_wallets;
begin
  select * into task_row from public.tasks where id = target_task_id for update;
  if not found or not private.is_family_parent(task_row.family_id) then raise exception 'task not found or not authorized' using errcode = '42501'; end if;
  if task_row.status <> 'pending' then raise exception 'task is not pending'; end if;
  select * into child_row from public.child_profiles where id = task_row.child_profile_id for update;
  if task_row.points > 0 and not exists (select 1 from public.point_ledger where task_id = task_row.id and entry_type = 'task_approved') then
    insert into public.point_ledger (family_id, child_profile_id, task_id, entry_type, points_delta, note) values (task_row.family_id, task_row.child_profile_id, task_row.id, 'task_approved', task_row.points, 'task approved');
    update public.child_profiles set points_balance = points_balance + task_row.points where id = child_row.id;
  end if;
  insert into public.child_game_wallets (family_id, child_profile_id) values (task_row.family_id, task_row.child_profile_id) on conflict do nothing;
  select * into wallet_row from public.child_game_wallets where child_profile_id = task_row.child_profile_id for update;
  if not exists (select 1 from public.game_currency_ledger where source_task_id = task_row.id and entry_type = 'task_approved') then
    insert into public.game_currency_ledger (family_id, child_profile_id, entry_type, amount_delta, source_task_id, note) values (task_row.family_id, task_row.child_profile_id, 'task_approved', 1, task_row.id, 'approved task reward');
    update public.child_game_wallets set scroll_balance = scroll_balance + 1 where child_profile_id = task_row.child_profile_id;
  end if;
  update public.tasks set status = 'completed' where id = task_row.id returning * into task_row;
  return task_row;
end;
$$;

create or replace function public.batch_review_daily_adventures(target_task_ids uuid[])
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private
as $$
declare target_task_id uuid; reviewed_task public.tasks; results jsonb := '[]'::jsonb; failed_task_ids uuid[] := array[]::uuid[];
begin
  if (select auth.uid()) is null or target_task_ids is null or cardinality(target_task_ids) = 0 then raise exception 'at least one task is required' using errcode = '22023'; end if;
  for target_task_id in select distinct task_id from unnest(target_task_ids) task_id order by task_id loop
    begin
      select * into reviewed_task from public.tasks where id = target_task_id for update;
      if not found or reviewed_task.adventure_type <> 'daily' or reviewed_task.status <> 'pending' or not private.is_family_parent(reviewed_task.family_id) then raise exception 'task is not a pending daily adventure'; end if;
      reviewed_task := public.review_adventure_completion(target_task_id, true, null, null, null, 'encouraging', null);
      results := results || jsonb_build_array(jsonb_build_object('task_id', reviewed_task.id, 'success', true, 'status', reviewed_task.status));
    exception when others then
      failed_task_ids := array_append(failed_task_ids, target_task_id);
      results := results || jsonb_build_array(jsonb_build_object('task_id', target_task_id, 'success', false, 'error', sqlerrm));
    end;
  end loop;
  return jsonb_build_object('results', results, 'failed_task_ids', to_jsonb(failed_task_ids));
end;
$$;

create or replace function public.revoke_task_approval(target_task_id uuid)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, private
as $$
declare task_row public.tasks; child_row public.child_profiles; wallet_row public.child_game_wallets; original_point public.point_ledger; original_scroll bigint; points_reversed integer; scroll_reversed bigint; reason text := null;
begin
  select * into task_row from public.tasks where id = target_task_id for update;
  if not found or not private.is_family_parent(task_row.family_id) or task_row.status <> 'completed' then raise exception 'task is not an approved task' using errcode = '22023'; end if;
  if exists (select 1 from public.task_approval_corrections where task_id = target_task_id) then raise exception 'task approval has already been corrected' using errcode = '23505'; end if;
  select * into child_row from public.child_profiles where id = task_row.child_profile_id for update;
  select * into wallet_row from public.child_game_wallets where child_profile_id = task_row.child_profile_id for update;
  select * into original_point from public.point_ledger where task_id = target_task_id and entry_type = 'task_approved' limit 1;
  original_scroll := coalesce((select sum(amount_delta) from public.game_currency_ledger where source_task_id = target_task_id and entry_type = 'task_approved'), 0);
  points_reversed := least(coalesce(original_point.points_delta, 0), child_row.points_balance);
  scroll_reversed := least(greatest(original_scroll, 0), coalesce(wallet_row.scroll_balance, 0));
  if coalesce(original_point.points_delta, 0) > points_reversed or original_scroll > scroll_reversed then reason := '孩子已使用部分獎勵，未追回的部分保留且不會再次發放'; end if;
  if points_reversed > 0 then
    insert into public.point_ledger (family_id, child_profile_id, task_id, entry_type, points_delta, note, reversal_of_ledger_id)
    values (task_row.family_id, task_row.child_profile_id, task_row.id, 'task_approval_reversal', -points_reversed, 'task approval correction', original_point.id);
    update public.child_profiles set points_balance = points_balance - points_reversed where id = child_row.id;
  end if;
  if scroll_reversed > 0 then
    insert into public.game_currency_ledger (family_id, child_profile_id, entry_type, amount_delta, source_task_id, note)
    values (task_row.family_id, task_row.child_profile_id, 'task_approval_reversal', -scroll_reversed, task_row.id, 'task approval correction');
    update public.child_game_wallets set scroll_balance = scroll_balance - scroll_reversed where child_profile_id = task_row.child_profile_id;
  end if;
  if points_reversed = 0 and scroll_reversed = 0 then reason := coalesce(reason, '孩子已使用獎勵，因此不追回，也不會再次發放'); end if;
  insert into public.task_approval_corrections (family_id, child_profile_id, task_id, corrected_by, points_reversed, scroll_reversed, reward_retained_reason)
  values (task_row.family_id, task_row.child_profile_id, task_row.id, (select auth.uid()), points_reversed, scroll_reversed, reason);
  update public.tasks set status = 'pending', reviewed_at = null, reviewed_by = null, approved_points = null where id = task_row.id returning * into task_row;
  return jsonb_build_object('task_id', task_row.id, 'points_reversed', points_reversed, 'scroll_reversed', scroll_reversed, 'message', case when reason is null then '已撤銷並收回獎勵' else '已撤銷；孩子已使用獎勵，因此不追回，也不會再次發放' end);
end;
$$;

revoke all on function private.resolve_game_child(uuid) from public, anon, authenticated;
revoke all on function private.validate_world_transform(uuid, uuid, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon, authenticated;
revoke all on function public.purchase_game_item(uuid, integer, uuid, uuid) from public, anon;
grant execute on function public.purchase_game_item(uuid, integer, uuid, uuid) to authenticated;
revoke all on function public.set_family_game_item_price(uuid, integer) from public, anon;
grant execute on function public.set_family_game_item_price(uuid, integer) to authenticated;
revoke all on function public.reset_family_game_item_price(uuid) from public, anon;
grant execute on function public.reset_family_game_item_price(uuid) to authenticated;
revoke all on function public.equip_game_character(uuid, uuid) from public, anon;
grant execute on function public.equip_game_character(uuid, uuid) to authenticated;
revoke all on function public.set_following_pet(uuid, uuid) from public, anon;
grant execute on function public.set_following_pet(uuid, uuid) to authenticated;
revoke all on function public.set_roaming_pets(uuid[], uuid) from public, anon;
grant execute on function public.set_roaming_pets(uuid[], uuid) to authenticated;
revoke all on function public.place_world_entity(uuid, bigint, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, smallint, uuid) from public, anon;
grant execute on function public.place_world_entity(uuid, bigint, numeric, numeric, numeric, numeric, numeric, numeric, numeric, text, smallint, uuid) to authenticated;
revoke all on function public.update_world_entity_transform(uuid, bigint, numeric, numeric, numeric, numeric, numeric, numeric, numeric, uuid, uuid) from public, anon;
grant execute on function public.update_world_entity_transform(uuid, bigint, numeric, numeric, numeric, numeric, numeric, numeric, numeric, uuid, uuid) to authenticated;
revoke all on function public.remove_world_entity(uuid, bigint, uuid, uuid) from public, anon;
grant execute on function public.remove_world_entity(uuid, bigint, uuid, uuid) to authenticated;
revoke all on function public.collect_all_world_decorations(bigint, uuid) from public, anon;
grant execute on function public.collect_all_world_decorations(bigint, uuid) to authenticated;
revoke all on function public.revoke_task_approval(uuid) from public, anon;
grant execute on function public.revoke_task_approval(uuid) to authenticated;

revoke all on function public.review_adventure_completion(uuid, boolean, integer, text, text, text, text) from public, anon;
grant execute on function public.review_adventure_completion(uuid, boolean, integer, text, text, text, text) to authenticated;
revoke all on function public.review_task_completion(uuid, boolean, integer, text, text, text, text) from public, anon;
grant execute on function public.review_task_completion(uuid, boolean, integer, text, text, text, text) to authenticated;
revoke all on function public.approve_task_completion(uuid) from public, anon;
grant execute on function public.approve_task_completion(uuid) to authenticated;
revoke all on function public.batch_review_daily_adventures(uuid[]) from public, anon;
grant execute on function public.batch_review_daily_adventures(uuid[]) to authenticated;
