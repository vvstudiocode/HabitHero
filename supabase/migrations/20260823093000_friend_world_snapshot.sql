-- Phase 2 friend-world data boundary.
--
-- This migration deliberately consumes the Phase 1 friendship migration's two
-- canonical, RLS-protected relationship tables:
--   child_friendships(child_profile_id, friend_child_profile_id, status)
--   child_friend_blocks(blocker_child_profile_id, blocked_child_profile_id)
-- It does not create a room, presence, position, or realtime schema object.

create or replace function private.can_visit_friend_world(
  requester_user_id uuid,
  world_owner_child_profile_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  requester_child_profile_id uuid;
begin
  -- The first argument exists for RLS call-site clarity, but it is never a
  -- caller-controlled identity. A forged requester must fail closed.
  if requester_user_id is null
     or requester_user_id is distinct from (select auth.uid())
     or world_owner_child_profile_id is null then
    return false;
  end if;

  select child.id
    into requester_child_profile_id
    from public.child_profiles child
   where child.profile_id = (select auth.uid())
   limit 1;

  if requester_child_profile_id is null
     or not exists (
       select 1
         from public.child_profiles owner_child
        where owner_child.id = world_owner_child_profile_id
     ) then
    return false;
  end if;

  -- The owner can always read their own safe projection. A block can never
  -- grant cross-child access, and this branch does not grant it.
  if requester_child_profile_id = world_owner_child_profile_id then
    return true;
  end if;

  if exists (
    select 1
      from public.child_friend_blocks block
     where (block.blocker_child_profile_id = requester_child_profile_id
        and block.blocked_child_profile_id = world_owner_child_profile_id)
        or (block.blocker_child_profile_id = world_owner_child_profile_id
        and block.blocked_child_profile_id = requester_child_profile_id)
  ) then
    return false;
  end if;

  return exists (
    select 1
      from public.child_friendships friendship
     where ((friendship.child_profile_id = requester_child_profile_id
        and friendship.friend_child_profile_id = world_owner_child_profile_id)
        or (friendship.child_profile_id = world_owner_child_profile_id
        and friendship.friend_child_profile_id = requester_child_profile_id))
       and friendship.status = 'accepted'
       -- Keep rejected relationship states explicit in the security contract.
       and friendship.status not in ('pending', 'declined', 'removed')
  );
end;
$$;

create or replace function public.get_friend_world_snapshot(target_child_profile_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  owner_child_id uuid;
  owner_display_name text;
  owner_character_asset_key text;
  world_revision bigint := 0;
  entity_payload jsonb := '[]'::jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not private.can_visit_friend_world((select auth.uid()), target_child_profile_id) then
    raise exception 'friend world not found or not authorized' using errcode = '42501';
  end if;

  select child.id, child.display_name, child.character_id
    into owner_child_id, owner_display_name, owner_character_asset_key
    from public.child_profiles child
   where child.id = target_child_profile_id;

  if owner_child_id is null then
    raise exception 'friend world not found or not authorized' using errcode = '42501';
  end if;

  select state.revision
    into world_revision
    from public.child_world_states state
   where state.child_profile_id = target_child_profile_id;
  world_revision := coalesce(world_revision, 0);

  -- The projection is deliberately assembled field by field. It contains no
  -- family, parent, points, wallet, quantity, task, or inventory identifiers.
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', entity_row.id,
        'entity_kind', entity_row.entity_kind,
        'asset_key', entity_row.asset_key,
        'position_x', entity_row.position_x,
        'position_y', entity_row.position_y,
        'position_z', entity_row.position_z,
        'rotation_x', entity_row.rotation_x,
        'rotation_y', entity_row.rotation_y,
        'rotation_z', entity_row.rotation_z,
        'scale', entity_row.scale,
        'behavior_mode', entity_row.behavior_mode,
        'display_name', entity_row.display_name
      ) order by entity_row.id
    ),
    '[]'::jsonb
  )
    into entity_payload
    from (
      select entity.id,
             entity.entity_kind,
             catalog.asset_key,
             entity.position_x,
             entity.position_y,
             entity.position_z,
             entity.rotation_x,
             entity.rotation_y,
             entity.rotation_z,
             entity.scale,
             entity.behavior_mode,
             case when entity.entity_kind = 'pet' then inventory.display_name else null end as display_name
        from public.child_world_entities entity
        join public.child_inventory_items inventory
          on inventory.id = entity.inventory_item_id
         and inventory.child_profile_id = target_child_profile_id
         and inventory.quantity > 0
        join public.game_catalog_items catalog
          on catalog.id = inventory.catalog_item_id
       where entity.child_profile_id = target_child_profile_id
         and entity.is_active
       order by entity.id
       limit 250
    ) entity_row;

  return jsonb_build_object(
    'world_owner_child_profile_id', owner_child_id,
    'display_name', owner_display_name,
    'character_asset_key', owner_character_asset_key,
    'revision', world_revision,
    'entities', entity_payload
  );
end;
$$;

-- Supabase Realtime private channels use the fixed topic
-- friend-world:<world_owner_child_profile_id>. The RLS conditions below are
-- the only access path; there is intentionally no public-channel fallback.
-- Every client must subscribe with private: true.
-- A CASE guards the UUID cast for malformed topics before the visit check.

create policy friend_world_broadcast_select
on realtime.messages
for select to authenticated
using (
  extension = 'broadcast'
  and realtime.topic() ~ '^friend-world:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and private.can_visit_friend_world(
    (select auth.uid()),
    case when realtime.topic() like 'friend-world:%'
      then split_part(realtime.topic(), 'friend-world:', 2)::uuid
      else null
    end
  )
);

create policy friend_world_broadcast_insert
on realtime.messages
for insert to authenticated
with check (
  extension = 'broadcast'
  and realtime.topic() ~ '^friend-world:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and private.can_visit_friend_world(
    (select auth.uid()),
    case when realtime.topic() like 'friend-world:%'
      then split_part(realtime.topic(), 'friend-world:', 2)::uuid
      else null
    end
  )
);

create policy friend_world_presence_select
on realtime.messages
for select to authenticated
using (
  extension = 'presence'
  and realtime.topic() ~ '^friend-world:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and private.can_visit_friend_world(
    (select auth.uid()),
    case when realtime.topic() like 'friend-world:%'
      then split_part(realtime.topic(), 'friend-world:', 2)::uuid
      else null
    end
  )
);

create policy friend_world_presence_insert
on realtime.messages
for insert to authenticated
with check (
  extension = 'presence'
  and realtime.topic() ~ '^friend-world:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and private.can_visit_friend_world(
    (select auth.uid()),
    case when realtime.topic() like 'friend-world:%'
      then split_part(realtime.topic(), 'friend-world:', 2)::uuid
      else null
    end
  )
);

revoke all on function private.can_visit_friend_world(uuid, uuid) from public, anon;
grant execute on function private.can_visit_friend_world(uuid, uuid) to authenticated;
revoke all on function public.get_friend_world_snapshot(uuid) from public, anon;
grant execute on function public.get_friend_world_snapshot(uuid) to authenticated;

-- Revisions are owner-generated hints for visitors. The payload never carries
-- a world mutation; clients must reload the authorized snapshot before using
-- the new revision.
create or replace function private.broadcast_friend_world_revision()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if new.revision > old.revision then
    perform realtime.send(
      jsonb_build_object(
        'world_owner_child_profile_id', new.child_profile_id,
        'revision', new.revision
      ),
      'world_revision_v1',
      'friend-world:' || new.child_profile_id::text,
      true
    );
  end if;
  return new;
end;
$$;

drop trigger if exists child_world_states_friend_revision on public.child_world_states;
create trigger child_world_states_friend_revision
after update of revision on public.child_world_states
for each row
execute function private.broadcast_friend_world_revision();

revoke all on function private.broadcast_friend_world_revision() from public, anon, authenticated;
