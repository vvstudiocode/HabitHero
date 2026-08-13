-- Allow repeatable pet purchases while keeping each pet independently
-- addressable for following and roaming. Decorations retain quantity stacking,
-- and characters retain single ownership.

begin;

alter table public.child_inventory_items
  add column if not exists instance_number integer not null default 1
    check (instance_number >= 1);

drop index if exists public.child_inventory_non_stackable_unique;

alter table public.child_inventory_items
  add constraint child_inventory_instance_unique
    unique (child_profile_id, catalog_item_id, instance_number);

alter table public.game_item_purchases
  add column if not exists inventory_item_id uuid
    references public.child_inventory_items(id) on delete restrict;

create index if not exists game_item_purchases_inventory_item_idx
  on public.game_item_purchases (inventory_item_id)
  where inventory_item_id is not null;

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
  repeatable_pet boolean := false;
  next_instance_number integer := 1;
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  if target_quantity is null or target_quantity <= 0 or purchase_idempotency_key is null then
    raise exception 'purchase details are invalid' using errcode = '22023';
  end if;

  insert into public.child_game_wallets (family_id, child_profile_id)
  values (child_row.family_id, child_row.id)
  on conflict (child_profile_id) do nothing;
  select * into wallet_row
    from public.child_game_wallets
   where child_profile_id = child_row.id
   for update;

  select * into purchase_row
    from public.game_item_purchases
   where child_profile_id = child_row.id
     and idempotency_key = purchase_idempotency_key;
  if found then
    if purchase_row.inventory_item_id is not null then
      select * into inventory_row
        from public.child_inventory_items
       where id = purchase_row.inventory_item_id
         and child_profile_id = child_row.id;
    else
      -- Compatibility fallback for purchases created before the exact inventory
      -- link existed. New purchases always use inventory_item_id above.
      select * into inventory_row
        from public.child_inventory_items
       where child_profile_id = child_row.id
         and catalog_item_id = purchase_row.catalog_item_id
       order by instance_number, acquired_at, id
       limit 1;
    end if;
    if not found then
      raise exception 'purchase inventory item is missing' using errcode = 'P0002';
    end if;
    return jsonb_build_object(
      'purchase_id', purchase_row.id,
      'wallet_balance', wallet_row.scroll_balance,
      'inventory_item_id', inventory_row.id,
      'quantity', inventory_row.quantity,
      'idempotent_replay', true
    );
  end if;

  select * into catalog_row
    from public.game_catalog_items
   where id = target_catalog_item_id
   for update;
  if not found or not catalog_row.is_active or catalog_row.is_starter then
    raise exception 'catalog item is not purchasable' using errcode = '22023';
  end if;
  repeatable_pet := catalog_row.item_type = 'pet';
  if not catalog_row.is_stackable and target_quantity <> 1 then
    raise exception 'this item cannot be purchased in a quantity' using errcode = '22023';
  end if;

  select scroll_price into family_override
    from public.family_game_item_prices
   where family_id = child_row.family_id
     and catalog_item_id = catalog_row.id;
  unit_price := coalesce(family_override, catalog_row.scroll_price);
  if unit_price < 1 then
    raise exception 'catalog price is invalid' using errcode = '22023';
  end if;
  total_price := unit_price::bigint * target_quantity::bigint;
  if wallet_row.scroll_balance < total_price then
    raise exception 'insufficient quest scrolls' using errcode = '22003';
  end if;

  if repeatable_pet then
    select coalesce(max(existing_inventory.instance_number), 0) + 1
      into next_instance_number
      from public.child_inventory_items existing_inventory
     where existing_inventory.child_profile_id = child_row.id
       and existing_inventory.catalog_item_id = catalog_row.id;
  else
    select * into inventory_row
      from public.child_inventory_items
     where child_profile_id = child_row.id
       and catalog_item_id = catalog_row.id
       and instance_number = 1
     for update;
    inventory_found := found;
    if inventory_found and not catalog_row.is_stackable then
      raise exception 'item is already owned' using errcode = '23505';
    end if;
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
    child_row.family_id, child_row.id, 'purchase', -total_price,
    purchase_row.id, 'game item purchase'
  );

  if repeatable_pet then
    insert into public.child_inventory_items (
      family_id, child_profile_id, catalog_item_id, quantity, acquired_via, instance_number
    ) values (
      child_row.family_id, child_row.id, catalog_row.id, 1, 'purchase', next_instance_number
    ) returning * into inventory_row;
  elsif inventory_found then
    update public.child_inventory_items
       set quantity = quantity + target_quantity
     where id = inventory_row.id
     returning * into inventory_row;
  else
    insert into public.child_inventory_items (
      family_id, child_profile_id, catalog_item_id, quantity, acquired_via, instance_number
    ) values (
      child_row.family_id, child_row.id, catalog_row.id, target_quantity, 'purchase', 1
    ) returning * into inventory_row;
  end if;

  update public.game_item_purchases
     set inventory_item_id = inventory_row.id
   where id = purchase_row.id
   returning * into purchase_row;

  return jsonb_build_object(
    'purchase_id', purchase_row.id,
    'wallet_balance', wallet_row.scroll_balance,
    'inventory_item_id', inventory_row.id,
    'quantity', inventory_row.quantity,
    'idempotent_replay', false
  );
end;
$$;

revoke all on function public.purchase_game_item(uuid, integer, uuid, uuid) from public, anon;
grant execute on function public.purchase_game_item(uuid, integer, uuid, uuid) to authenticated;

commit;
