-- Load the shared decorations placed in the authenticated child's own world.
-- This is a read-only projection: the client still uses the typed shared
-- decoration RPCs for every mutation.
create or replace function public.get_my_shared_world_decorations(
  target_child_profile_id uuid
)
returns table(
  id uuid,
  source_inventory_item_id uuid,
  catalog_item_id uuid,
  asset_key text,
  position_x numeric,
  position_y numeric,
  position_z numeric,
  rotation_x numeric,
  rotation_y numeric,
  rotation_z numeric,
  scale numeric,
  behavior_mode text,
  is_active boolean,
  shared_by_me boolean,
  shared_source_display_name text
)
language sql
security definer
set search_path = ''
as $$
  select
    shared.id,
    null::uuid,
    catalog.id,
    catalog.asset_key,
    shared.position_x,
    shared.position_y,
    shared.position_z,
    shared.rotation_x,
    shared.rotation_y,
    shared.rotation_z,
    shared.scale,
    shared.behavior_mode,
    shared.is_active,
    false,
    source.display_name
  from public.child_shared_world_decorations shared
  join public.child_inventory_items inventory
    on inventory.id = shared.source_inventory_item_id
   and inventory.quantity > 0
  join public.game_catalog_items catalog
    on catalog.id = inventory.catalog_item_id
   and catalog.item_type = 'decoration'
   and catalog.is_active
  join public.child_profiles source
    on source.id = shared.source_child_profile_id
  where shared.world_owner_child_profile_id = target_child_profile_id
    and shared.is_active
    and private.are_accepted_unblocked_friends(shared.world_owner_child_profile_id, shared.source_child_profile_id)
    and target_child_profile_id = private.shared_decoration_actor_child();
$$;
revoke all on function public.get_my_shared_world_decorations(uuid) from public, anon;
grant execute on function public.get_my_shared_world_decorations(uuid) to authenticated;
