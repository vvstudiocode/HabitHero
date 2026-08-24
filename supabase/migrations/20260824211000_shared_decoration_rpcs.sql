create or replace function private.are_accepted_unblocked_friends(
  first_child_profile_id uuid,
  second_child_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select first_child_profile_id is not null
     and second_child_profile_id is not null
     and first_child_profile_id <> second_child_profile_id
     and exists (
       select 1 from public.child_friendships friendship
        where friendship.status = 'accepted'
          and ((friendship.child_profile_id = first_child_profile_id and friendship.friend_child_profile_id = second_child_profile_id)
            or (friendship.child_profile_id = second_child_profile_id and friendship.friend_child_profile_id = first_child_profile_id))
     )
     and not exists (
       select 1 from public.child_friend_blocks block
        where (block.blocker_child_profile_id = first_child_profile_id and block.blocked_child_profile_id = second_child_profile_id)
           or (block.blocker_child_profile_id = second_child_profile_id and block.blocked_child_profile_id = first_child_profile_id)
     );
$$;

create or replace function private.lock_shared_decoration_pair(
  first_child_profile_id uuid,
  second_child_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if first_child_profile_id is not null
     and second_child_profile_id is not null
     and first_child_profile_id <> second_child_profile_id then
    perform pg_advisory_xact_lock(hashtextextended(
      least(first_child_profile_id, second_child_profile_id)::text || ':' || greatest(first_child_profile_id, second_child_profile_id)::text,
      0
    ));
  end if;
end;
$$;

create or replace function private.shared_decoration_actor_child()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select child.id from public.child_profiles child where child.profile_id = (select auth.uid()) limit 1;
$$;

create or replace function private.shared_decoration_entity_payload(
  target_entity public.child_shared_world_decorations,
  viewer_child_profile_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', target_entity.id,
    'entity_kind', 'decoration',
    'asset_key', catalog.asset_key,
    'position_x', target_entity.position_x,
    'position_y', target_entity.position_y,
    'position_z', target_entity.position_z,
    'rotation_x', target_entity.rotation_x,
    'rotation_y', target_entity.rotation_y,
    'rotation_z', target_entity.rotation_z,
    'scale', target_entity.scale,
    'behavior_mode', target_entity.behavior_mode,
    'placement_scope', 'shared',
    'can_transform', target_entity.world_owner_child_profile_id = viewer_child_profile_id
      or (target_entity.source_child_profile_id = viewer_child_profile_id and coalesce(collaborator.can_collaborate, false)),
    'can_remove', target_entity.world_owner_child_profile_id = viewer_child_profile_id
      or target_entity.source_child_profile_id = viewer_child_profile_id,
    'shared_by_me', target_entity.source_child_profile_id = viewer_child_profile_id,
    'shared_source_display_name', case
      when target_entity.source_child_profile_id = viewer_child_profile_id
        or target_entity.world_owner_child_profile_id = viewer_child_profile_id
      then source.display_name else null end
  )
  from public.child_inventory_items inventory
  join public.game_catalog_items catalog on catalog.id = inventory.catalog_item_id
  join public.child_profiles source on source.id = target_entity.source_child_profile_id
  left join public.child_world_decoration_collaborators collaborator
    on collaborator.world_owner_child_profile_id = target_entity.world_owner_child_profile_id
   and collaborator.collaborator_child_profile_id = target_entity.source_child_profile_id
  where inventory.id = target_entity.source_inventory_item_id
    and inventory.quantity > 0
    and catalog.item_type = 'decoration'
    and catalog.is_active;
$$;

create or replace function public.set_friend_world_decoration_collaboration(
  target_world_owner_child_profile_id uuid,
  target_collaborator_child_profile_id uuid,
  target_can_collaborate boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.shared_decoration_actor_child();
  previous_can_collaborate boolean;
  world_revision bigint;
begin
  -- Actor identity is fixed by auth.uid() inside the private helper.
  if actor is null or actor <> target_world_owner_child_profile_id
     or target_can_collaborate is null
     or not private.are_accepted_unblocked_friends(actor, target_collaborator_child_profile_id) then
    raise exception 'friend decoration collaboration is not authorized' using errcode = '42501';
  end if;
  perform private.lock_shared_decoration_pair(actor, target_collaborator_child_profile_id);
  insert into public.child_world_states (family_id, child_profile_id)
  select child.family_id, child.id
    from public.child_profiles child
   where child.id = actor
  on conflict (child_profile_id) do nothing;
  select state.revision
    into world_revision
    from public.child_world_states state
   where state.child_profile_id = actor
   for update;
  if world_revision is null then
    raise exception 'world state unavailable' using errcode = 'P0001';
  end if;
  if not private.are_accepted_unblocked_friends(actor, target_collaborator_child_profile_id) then
    raise exception 'friend decoration collaboration is not authorized' using errcode = '42501';
  end if;
  select collaborator.can_collaborate
    into previous_can_collaborate
    from public.child_world_decoration_collaborators collaborator
   where collaborator.world_owner_child_profile_id = actor
     and collaborator.collaborator_child_profile_id = target_collaborator_child_profile_id;
  if (previous_can_collaborate is null and target_can_collaborate = false)
     or previous_can_collaborate is not distinct from target_can_collaborate then
    return;
  end if;
  update public.child_world_states state
     set revision = state.revision + 1
   where state.child_profile_id = actor;
  insert into public.child_world_decoration_collaborators (world_owner_child_profile_id, collaborator_child_profile_id, can_collaborate)
  values (actor, target_collaborator_child_profile_id, target_can_collaborate)
  on conflict (world_owner_child_profile_id, collaborator_child_profile_id)
  do update set can_collaborate = excluded.can_collaborate;
end;
$$;
revoke all on function public.set_friend_world_decoration_collaboration(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_friend_world_decoration_collaboration(uuid, uuid, boolean) to authenticated;

create or replace function public.place_shared_world_decoration(
  target_world_owner_child_profile_id uuid,
  source_inventory_item_id uuid,
  expected_revision bigint,
  position_x numeric,
  position_y numeric,
  position_z numeric,
  rotation_x numeric,
  rotation_y numeric,
  rotation_z numeric,
  scale numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.shared_decoration_actor_child();
  inventory_row public.child_inventory_items;
  catalog_row public.game_catalog_items;
  world_child public.child_profiles;
  next_revision bigint;
  entity_row public.child_shared_world_decorations;
begin
  -- The actor is derived from auth.uid(), never accepted from the browser.
  select * into inventory_row from public.child_inventory_items where id = source_inventory_item_id and quantity > 0;
  select * into catalog_row from public.game_catalog_items
   where id = inventory_row.catalog_item_id and is_active and item_type = 'decoration'
   for share;
  select * into world_child from public.child_profiles where id = target_world_owner_child_profile_id;
  if actor is null or inventory_row.id is null or world_child.id is null then
    raise exception 'shared decoration placement is not authorized' using errcode = '42501';
  end if;
  -- Lock both profile rows before the pair lock. Profile deletion and the
  -- friendship RPCs use the same profile-before-pair order, so FK checks on
  -- the insert cannot wait on a profile while holding the pair lock.
  perform 1
    from public.child_profiles child
   where child.id in (actor, target_world_owner_child_profile_id)
   order by child.id
   for share;
  perform private.lock_shared_decoration_pair(actor, target_world_owner_child_profile_id);
  insert into public.child_world_states (family_id, child_profile_id)
  values (world_child.family_id, target_world_owner_child_profile_id)
  on conflict (child_profile_id) do nothing;
  select state.revision into next_revision from public.child_world_states state where state.child_profile_id = target_world_owner_child_profile_id for update;
  if expected_revision is null or next_revision is null or expected_revision <> next_revision then raise exception 'world revision conflict' using errcode = '40001'; end if;
  -- Re-check all relationship and source ownership facts after the world lock.
  -- Friendship cleanup takes the same world lock before deactivating rows.
  select * into inventory_row from public.child_inventory_items where id = source_inventory_item_id and quantity > 0;
  select * into catalog_row from public.game_catalog_items
   where id = inventory_row.catalog_item_id and is_active and item_type = 'decoration'
   for share;
  if actor is null or inventory_row.id is null or inventory_row.child_profile_id <> actor or catalog_row.id is null
     or world_child.id is null or not private.are_accepted_unblocked_friends(actor, target_world_owner_child_profile_id)
     or not exists (select 1 from public.child_world_decoration_collaborators grant_row where grant_row.world_owner_child_profile_id = target_world_owner_child_profile_id and grant_row.collaborator_child_profile_id = actor and grant_row.can_collaborate) then
    raise exception 'shared decoration placement is not authorized' using errcode = '42501';
  end if;
  perform private.validate_world_transform(target_world_owner_child_profile_id, null, 'decoration', position_x, position_y, position_z, scale, catalog_row.collision_radius, catalog_row.min_scale, catalog_row.max_scale);
  if (select count(*) from public.child_shared_world_decorations shared where shared.world_owner_child_profile_id = target_world_owner_child_profile_id and shared.source_child_profile_id = actor and shared.is_active) >= 10
     or (select count(*) from public.child_shared_world_decorations shared where shared.world_owner_child_profile_id = target_world_owner_child_profile_id and shared.is_active) >= 50 then
    raise exception 'shared decoration capacity reached' using errcode = '22003';
  end if;
  update public.child_world_states set revision = revision + 1 where child_profile_id = target_world_owner_child_profile_id returning revision into next_revision;
  insert into public.child_shared_world_decorations (
    family_id, world_owner_child_profile_id, source_child_profile_id, source_inventory_item_id,
    position_x, position_y, position_z, rotation_x, rotation_y, rotation_z, scale
  ) values (
    world_child.family_id, target_world_owner_child_profile_id, actor, source_inventory_item_id,
    position_x, position_y, position_z, rotation_x, rotation_y, rotation_z, scale
  ) returning * into entity_row;
  return jsonb_build_object('revision', next_revision, 'entity', private.shared_decoration_entity_payload(entity_row, actor));
end;
$$;
revoke all on function public.place_shared_world_decoration(uuid, uuid, bigint, numeric, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.place_shared_world_decoration(uuid, uuid, bigint, numeric, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated;

create or replace function public.update_shared_world_decoration_transform(
  target_world_owner_child_profile_id uuid,
  shared_entity_id uuid,
  expected_revision bigint,
  position_x numeric,
  position_y numeric,
  position_z numeric,
  rotation_x numeric,
  rotation_y numeric,
  rotation_z numeric,
  scale numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.shared_decoration_actor_child();
  entity_row public.child_shared_world_decorations;
  entity_hint public.child_shared_world_decorations;
  catalog_row public.game_catalog_items;
  next_revision bigint;
begin
  -- The actor is derived from auth.uid(), never accepted from the browser.
  select entity.* into entity_hint from public.child_shared_world_decorations entity
   where entity.id = shared_entity_id and entity.world_owner_child_profile_id = target_world_owner_child_profile_id and entity.is_active;
  if entity_hint.id is not null then
    select catalog.* into catalog_row
      from public.child_inventory_items inventory
      join public.game_catalog_items catalog on catalog.id = inventory.catalog_item_id
     where inventory.id = entity_hint.source_inventory_item_id and catalog.is_active and catalog.item_type = 'decoration'
     for share of catalog;
  end if;
  perform private.lock_shared_decoration_pair(actor, target_world_owner_child_profile_id);
  insert into public.child_world_states (family_id, child_profile_id)
  select child.family_id, child.id
    from public.child_profiles child
   where child.id = target_world_owner_child_profile_id
  on conflict (child_profile_id) do nothing;
  select state.revision into next_revision from public.child_world_states state where state.child_profile_id = target_world_owner_child_profile_id for update;
  if expected_revision is null or next_revision is null or expected_revision <> next_revision then raise exception 'world revision conflict' using errcode = '40001'; end if;
  select entity.* into entity_row from public.child_shared_world_decorations entity
   where entity.id = shared_entity_id and entity.world_owner_child_profile_id = target_world_owner_child_profile_id and entity.is_active for update;
  select catalog.* into catalog_row from public.child_inventory_items inventory join public.game_catalog_items catalog on catalog.id = inventory.catalog_item_id
   where inventory.id = entity_row.source_inventory_item_id and inventory.quantity > 0 and catalog.item_type = 'decoration' and catalog.is_active;
  if actor is null or entity_row.id is null or catalog_row.id is null
     or not (
       actor = target_world_owner_child_profile_id
       or (
         actor = entity_row.source_child_profile_id
         and private.are_accepted_unblocked_friends(actor, target_world_owner_child_profile_id)
         and exists (select 1 from public.child_world_decoration_collaborators grant_row where grant_row.world_owner_child_profile_id = target_world_owner_child_profile_id and grant_row.collaborator_child_profile_id = actor and grant_row.can_collaborate)
       )
     ) then
    raise exception 'shared decoration transform is not authorized' using errcode = '42501';
  end if;
  perform private.validate_world_transform(target_world_owner_child_profile_id, null, 'decoration', position_x, position_y, position_z, scale, catalog_row.collision_radius, catalog_row.min_scale, catalog_row.max_scale);
  update public.child_world_states set revision = revision + 1 where child_profile_id = target_world_owner_child_profile_id returning revision into next_revision;
  update public.child_shared_world_decorations entity
     set position_x = update_shared_world_decoration_transform.position_x,
         position_y = update_shared_world_decoration_transform.position_y,
         position_z = update_shared_world_decoration_transform.position_z,
         rotation_x = update_shared_world_decoration_transform.rotation_x,
         rotation_y = update_shared_world_decoration_transform.rotation_y,
         rotation_z = update_shared_world_decoration_transform.rotation_z,
         scale = update_shared_world_decoration_transform.scale
   where entity.id = entity_row.id returning entity.* into entity_row;
  return jsonb_build_object('revision', next_revision, 'entity', private.shared_decoration_entity_payload(entity_row, actor));
end;
$$;
revoke all on function public.update_shared_world_decoration_transform(uuid, uuid, bigint, numeric, numeric, numeric, numeric, numeric, numeric, numeric) from public, anon;
grant execute on function public.update_shared_world_decoration_transform(uuid, uuid, bigint, numeric, numeric, numeric, numeric, numeric, numeric, numeric) to authenticated;

create or replace function public.remove_shared_world_decoration(
  target_world_owner_child_profile_id uuid,
  shared_entity_id uuid,
  expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.shared_decoration_actor_child();
  entity_row public.child_shared_world_decorations;
  entity_hint public.child_shared_world_decorations;
  catalog_row public.game_catalog_items;
  next_revision bigint;
begin
  -- The actor is derived from auth.uid(), never accepted from the browser.
  select entity.* into entity_hint from public.child_shared_world_decorations entity
   where entity.id = shared_entity_id and entity.world_owner_child_profile_id = target_world_owner_child_profile_id and entity.is_active;
  if entity_hint.id is not null then
    select catalog.* into catalog_row
      from public.child_inventory_items inventory
      join public.game_catalog_items catalog on catalog.id = inventory.catalog_item_id
     where inventory.id = entity_hint.source_inventory_item_id and catalog.is_active and catalog.item_type = 'decoration'
     for share of catalog;
  end if;
  perform private.lock_shared_decoration_pair(actor, target_world_owner_child_profile_id);
  insert into public.child_world_states (family_id, child_profile_id)
  select child.family_id, child.id
    from public.child_profiles child
   where child.id = target_world_owner_child_profile_id
  on conflict (child_profile_id) do nothing;
  select state.revision into next_revision from public.child_world_states state where state.child_profile_id = target_world_owner_child_profile_id for update;
  if expected_revision is null or next_revision is null or expected_revision <> next_revision then raise exception 'world revision conflict' using errcode = '40001'; end if;
  select entity.* into entity_row from public.child_shared_world_decorations entity
   where entity.id = shared_entity_id and entity.world_owner_child_profile_id = target_world_owner_child_profile_id and entity.is_active for update;
  if actor is null or entity_row.id is null
     or not (actor = target_world_owner_child_profile_id or actor = entity_row.source_child_profile_id) then
    raise exception 'shared decoration removal is not authorized' using errcode = '42501';
  end if;
  update public.child_world_states set revision = revision + 1 where child_profile_id = target_world_owner_child_profile_id returning revision into next_revision;
  update public.child_shared_world_decorations entity set is_active = false, removed_reason = case when actor = entity_row.source_child_profile_id then 'source_withdrew' else 'owner_removed' end where entity.id = entity_row.id;
  return jsonb_build_object('revision', next_revision);
end;
$$;
revoke all on function public.remove_shared_world_decoration(uuid, uuid, bigint) from public, anon;
grant execute on function public.remove_shared_world_decoration(uuid, uuid, bigint) to authenticated;

create or replace function public.collect_shared_world_decorations(
  target_world_owner_child_profile_id uuid,
  expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.shared_decoration_actor_child();
  next_revision bigint;
begin
  -- The actor is derived from auth.uid(), never accepted from the browser.
  if actor is null or actor <> target_world_owner_child_profile_id then
    raise exception 'shared decoration collection is not authorized' using errcode = '42501';
  end if;
  insert into public.child_world_states (family_id, child_profile_id)
  select child.family_id, child.id
    from public.child_profiles child
   where child.id = target_world_owner_child_profile_id
  on conflict (child_profile_id) do nothing;
  select state.revision into next_revision from public.child_world_states state where state.child_profile_id = target_world_owner_child_profile_id for update;
  if expected_revision is null or next_revision is null or expected_revision <> next_revision then raise exception 'world revision conflict' using errcode = '40001'; end if;
  if not exists (select 1 from public.child_shared_world_decorations shared where shared.world_owner_child_profile_id = target_world_owner_child_profile_id and shared.is_active) then
    return jsonb_build_object('revision', next_revision);
  end if;
  update public.child_world_states set revision = revision + 1 where child_profile_id = target_world_owner_child_profile_id returning revision into next_revision;
  update public.child_shared_world_decorations set is_active = false, removed_reason = 'owner_removed'
   where world_owner_child_profile_id = target_world_owner_child_profile_id and is_active;
  return jsonb_build_object('revision', next_revision);
end;
$$;
revoke all on function public.collect_shared_world_decorations(uuid, bigint) from public, anon;
grant execute on function public.collect_shared_world_decorations(uuid, bigint) to authenticated;

create or replace function private.friend_world_owned_entity_payload(
  target_entity public.child_world_entities,
  target_inventory public.child_inventory_items,
  target_catalog public.game_catalog_items
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', target_entity.id,
    'entity_kind', target_entity.entity_kind,
    'asset_key', target_catalog.asset_key,
    'position_x', target_entity.position_x,
    'position_y', target_entity.position_y,
    'position_z', target_entity.position_z,
    'rotation_x', target_entity.rotation_x,
    'rotation_y', target_entity.rotation_y,
    'rotation_z', target_entity.rotation_z,
    'scale', target_entity.scale,
    'behavior_mode', target_entity.behavior_mode,
    'placement_scope', 'owned',
    'can_transform', false,
    'can_remove', false,
    'shared_by_me', false,
    'display_name', case when target_entity.entity_kind = 'pet' then target_inventory.display_name else null end
  );
$$;

create or replace function public.get_friend_world_snapshot(target_child_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  viewer_child_id uuid := private.shared_decoration_actor_child();
  owner_display_name text;
  owner_character_asset_key text;
  world_revision bigint := 0;
  entity_payload jsonb := '[]'::jsonb;
  can_share boolean := false;
begin
  if (select auth.uid()) is null or not private.can_visit_friend_world((select auth.uid()), target_child_profile_id) then
    raise exception 'friend world not found or not authorized' using errcode = '42501';
  end if;
  select child.display_name, child.character_id into owner_display_name, owner_character_asset_key from public.child_profiles child where child.id = target_child_profile_id;
  select coalesce(state.revision, 0) into world_revision from public.child_world_states state where state.child_profile_id = target_child_profile_id;
  select coalesce(bool_or(grant_row.can_collaborate), false)
    into can_share
    from public.child_world_decoration_collaborators grant_row
   where grant_row.world_owner_child_profile_id = target_child_profile_id
     and grant_row.collaborator_child_profile_id = viewer_child_id
     and private.are_accepted_unblocked_friends(target_child_profile_id, viewer_child_id);
  select coalesce(jsonb_agg(entity_row.payload order by entity_row.sort_rank, entity_row.sort_time, entity_row.sort_id), jsonb_build_array()) into entity_payload
    from (
      select 0 as sort_rank, entity.id as sort_id, entity.updated_at as sort_time, private.friend_world_owned_entity_payload(entity, inventory, catalog) as payload
        from public.child_world_entities entity
      join public.child_inventory_items inventory on inventory.id = entity.inventory_item_id and inventory.child_profile_id = target_child_profile_id and inventory.quantity > 0
      join public.game_catalog_items catalog on catalog.id = inventory.catalog_item_id and catalog.is_active
      where entity.child_profile_id = target_child_profile_id and entity.is_active
      union all
      select 1 as sort_rank, shared.id as sort_id, shared.created_at as sort_time, private.shared_decoration_entity_payload(shared, viewer_child_id) as payload
        from public.child_shared_world_decorations shared
        join public.child_inventory_items inventory on inventory.id = shared.source_inventory_item_id and inventory.quantity > 0
        join public.game_catalog_items catalog on catalog.id = inventory.catalog_item_id and catalog.item_type = 'decoration' and catalog.is_active
       where shared.world_owner_child_profile_id = target_child_profile_id
         and shared.is_active
         and private.are_accepted_unblocked_friends(shared.world_owner_child_profile_id, shared.source_child_profile_id)
            order by sort_rank, sort_time, sort_id
            limit 250
            ) entity_row;
  -- jsonb_build_object('id', 'entity_kind', 'asset_key', 'position_x', 'position_y', 'position_z', 'rotation_x', 'rotation_y', 'rotation_z', 'scale', 'behavior_mode', 'placement_scope', 'can_transform', 'can_remove', 'shared_by_me', 'shared_source_display_name') order by entity_row.sort_id
  -- case when shared_source_display_name then source.display_name
  return jsonb_build_object('world_owner_child_profile_id', target_child_profile_id, 'display_name', owner_display_name, 'character_asset_key', owner_character_asset_key, 'revision', coalesce(world_revision, 0), 'can_share_decorations', can_share, 'entities', entity_payload);
end;
$$;
revoke all on function public.get_friend_world_snapshot(uuid) from public, anon;
grant execute on function public.get_friend_world_snapshot(uuid) to authenticated;

drop function if exists public.list_my_friends();
create or replace function public.list_my_friends()
returns table(child_profile_id uuid, display_name text, is_online boolean, world_revision bigint, can_collaborate_in_my_world boolean)
language sql
security definer
set search_path = ''
as $$
  select case when friendship.child_profile_id = actor.id then friendship.friend_child_profile_id else friendship.child_profile_id end,
         target.display_name,
         false,
         coalesce(world.revision, 0),
         coalesce(grant_row.can_collaborate, false)
    from public.child_friendships friendship
    join public.child_profiles actor on actor.profile_id = (select auth.uid())
    join public.child_profiles target on target.id = case when friendship.child_profile_id = actor.id then friendship.friend_child_profile_id else friendship.child_profile_id end
    left join public.child_world_states world on world.child_profile_id = target.id
    left join public.child_world_decoration_collaborators grant_row on grant_row.world_owner_child_profile_id = actor.id and grant_row.collaborator_child_profile_id = target.id
   where friendship.status = 'accepted'
     and (friendship.child_profile_id = actor.id or friendship.friend_child_profile_id = actor.id)
     and not exists (select 1 from public.child_friend_blocks block where (block.blocker_child_profile_id = actor.id and block.blocked_child_profile_id = target.id) or (block.blocker_child_profile_id = target.id and block.blocked_child_profile_id = actor.id));
$$;
revoke all on function public.list_my_friends() from public, anon;
grant execute on function public.list_my_friends() to authenticated;

revoke all on function private.are_accepted_unblocked_friends(uuid, uuid) from public, anon, authenticated;
revoke all on function private.lock_shared_decoration_pair(uuid, uuid) from public, anon, authenticated;
revoke all on function private.shared_decoration_actor_child() from public, anon, authenticated;
revoke all on function private.shared_decoration_entity_payload(public.child_shared_world_decorations, uuid) from public, anon, authenticated;
revoke all on function private.friend_world_owned_entity_payload(public.child_world_entities, public.child_inventory_items, public.game_catalog_items) from public, anon, authenticated;
