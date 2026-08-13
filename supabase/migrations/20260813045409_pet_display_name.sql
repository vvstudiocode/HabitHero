alter table public.child_inventory_items
  add column if not exists display_name text
    check (display_name is null or char_length(trim(display_name)) between 1 and 12);

create or replace function public.set_pet_display_name(
  target_inventory_item_id uuid,
  target_display_name text default null,
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
  normalized_name text := nullif(trim(target_display_name), '');
begin
  if normalized_name is not null and char_length(normalized_name) > 12 then
    raise exception 'pet name must be 12 characters or fewer' using errcode = '22023';
  end if;

  child_row := private.resolve_game_child(target_child_profile_id);
  select inventory.* into inventory_row
    from public.child_inventory_items inventory
    join public.game_catalog_items item on item.id = inventory.catalog_item_id
   where inventory.id = target_inventory_item_id
     and inventory.child_profile_id = child_row.id
     and inventory.quantity > 0
     and item.item_type = 'pet';
  if not found then
    raise exception 'pet is not owned by this child' using errcode = '42501';
  end if;

  update public.child_inventory_items
     set display_name = normalized_name
   where id = inventory_row.id;

  return jsonb_build_object(
    'inventory_item_id', inventory_row.id,
    'display_name', normalized_name
  );
end;
$$;

revoke all on function public.set_pet_display_name(uuid, text, uuid) from public, anon;
grant execute on function public.set_pet_display_name(uuid, text, uuid) to authenticated;
