-- The source inventory remains the owner; its cascade is guarded by the
-- cleanup trigger before the FK removes it:
-- references public.child_inventory_items(id) on delete cascade

create or replace function private.deactivate_shared_world_decorations_between(
  first_child_profile_id uuid,
  second_child_profile_id uuid,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_world record;
begin
  if target_reason not in ('friendship_removed', 'blocked') then
    raise exception 'invalid shared decoration cleanup reason' using errcode = '22023';
  end if;
  perform private.lock_shared_decoration_pair(first_child_profile_id, second_child_profile_id);
  for affected_world in
    select distinct shared.world_owner_child_profile_id
      from public.child_shared_world_decorations shared
     where shared.is_active
       and ((shared.world_owner_child_profile_id = first_child_profile_id and shared.source_child_profile_id = second_child_profile_id)
         or (shared.world_owner_child_profile_id = second_child_profile_id and shared.source_child_profile_id = first_child_profile_id))
     order by shared.world_owner_child_profile_id
  loop
    perform 1 from public.child_world_states state where state.child_profile_id = affected_world.world_owner_child_profile_id for update;
  end loop;
  for affected_world in
    select distinct shared.world_owner_child_profile_id
      from public.child_shared_world_decorations shared
     where shared.is_active
       and ((shared.world_owner_child_profile_id = first_child_profile_id and shared.source_child_profile_id = second_child_profile_id)
         or (shared.world_owner_child_profile_id = second_child_profile_id and shared.source_child_profile_id = first_child_profile_id))
     order by shared.world_owner_child_profile_id
  loop
    update public.child_shared_world_decorations shared
       set is_active = false, removed_reason = target_reason
     where shared.is_active
       and shared.world_owner_child_profile_id = affected_world.world_owner_child_profile_id
       and ((shared.world_owner_child_profile_id = first_child_profile_id and shared.source_child_profile_id = second_child_profile_id)
         or (shared.world_owner_child_profile_id = second_child_profile_id and shared.source_child_profile_id = first_child_profile_id));
    if found then
      update public.child_world_states set revision = revision + 1 where child_profile_id = affected_world.world_owner_child_profile_id;
    end if;
  end loop;
end;
$$;

create or replace function private.deactivate_shared_world_decorations_for_inventory(target_source_inventory_item_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_inventory_child_profile_id uuid;
  affected_world record;
begin
  select inventory.child_profile_id
    into source_inventory_child_profile_id
    from public.child_inventory_items inventory
   where inventory.id = target_source_inventory_item_id;
  for affected_world in
     select worlds.world_owner_child_profile_id
       from (
         select distinct shared.world_owner_child_profile_id
           from public.child_shared_world_decorations shared
          where shared.is_active and shared.source_inventory_item_id = target_source_inventory_item_id
       ) worlds
      order by least(source_inventory_child_profile_id, worlds.world_owner_child_profile_id), greatest(source_inventory_child_profile_id, worlds.world_owner_child_profile_id)
  loop
    perform private.lock_shared_decoration_pair(source_inventory_child_profile_id, affected_world.world_owner_child_profile_id);
  end loop;
  for affected_world in
     select worlds.world_owner_child_profile_id
       from (
         select distinct shared.world_owner_child_profile_id
           from public.child_shared_world_decorations shared
          where shared.is_active and shared.source_inventory_item_id = target_source_inventory_item_id
       ) worlds
      order by worlds.world_owner_child_profile_id
  loop
    perform 1 from public.child_world_states state where state.child_profile_id = affected_world.world_owner_child_profile_id for update;
  end loop;
  for affected_world in
     select worlds.world_owner_child_profile_id
       from (
         select distinct shared.world_owner_child_profile_id
           from public.child_shared_world_decorations shared
          where shared.is_active and shared.source_inventory_item_id = target_source_inventory_item_id
       ) worlds
      order by worlds.world_owner_child_profile_id
  loop
    update public.child_shared_world_decorations shared
       set is_active = false, removed_reason = 'source_unavailable'
     where shared.is_active
       and shared.world_owner_child_profile_id = affected_world.world_owner_child_profile_id
       and shared.source_inventory_item_id = target_source_inventory_item_id;
    if found then
      update public.child_world_states state
         set revision = state.revision + 1
       where state.child_profile_id = affected_world.world_owner_child_profile_id;
    end if;
  end loop;
end;
$$;

create or replace function private.cleanup_shared_decorations_for_source(target_source_child_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_world record;
begin
  for affected_world in
     select worlds.world_owner_child_profile_id
       from (
         select distinct shared.world_owner_child_profile_id
           from public.child_shared_world_decorations shared
          where shared.is_active and shared.source_child_profile_id = target_source_child_profile_id
       ) worlds
      order by least(target_source_child_profile_id, worlds.world_owner_child_profile_id), greatest(target_source_child_profile_id, worlds.world_owner_child_profile_id)
  loop
    perform private.lock_shared_decoration_pair(target_source_child_profile_id, affected_world.world_owner_child_profile_id);
  end loop;
  for affected_world in
     select worlds.world_owner_child_profile_id
       from (
         select distinct shared.world_owner_child_profile_id
           from public.child_shared_world_decorations shared
          where shared.is_active and shared.source_child_profile_id = target_source_child_profile_id
       ) worlds
      order by worlds.world_owner_child_profile_id
  loop
    perform 1 from public.child_world_states state where state.child_profile_id = affected_world.world_owner_child_profile_id for update;
  end loop;
  for affected_world in
     select worlds.world_owner_child_profile_id
       from (
         select distinct shared.world_owner_child_profile_id
           from public.child_shared_world_decorations shared
          where shared.is_active and shared.source_child_profile_id = target_source_child_profile_id
       ) worlds
      order by worlds.world_owner_child_profile_id
  loop
    update public.child_shared_world_decorations shared
       set is_active = false, removed_reason = 'source_unavailable'
     where shared.is_active
       and shared.world_owner_child_profile_id = affected_world.world_owner_child_profile_id
       and shared.source_child_profile_id = target_source_child_profile_id;
    if found then
      update public.child_world_states state
         set revision = state.revision + 1
       where state.child_profile_id = affected_world.world_owner_child_profile_id;
    end if;
  end loop;
end;
$$;

create or replace function private.cleanup_shared_decorations_before_source_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.cleanup_shared_decorations_for_source(old.id);
  return old;
end;
$$;

create or replace function private.cleanup_shared_decorations_before_inventory_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.deactivate_shared_world_decorations_for_inventory(old.id);
  return old;
end;
$$;

drop trigger if exists child_inventory_shared_decorations_cleanup on public.child_inventory_items;
create trigger child_inventory_shared_decorations_cleanup before delete on public.child_inventory_items
for each row execute function private.cleanup_shared_decorations_before_inventory_delete();

drop trigger if exists child_profile_shared_decorations_cleanup on public.child_profiles;
create trigger child_profile_shared_decorations_cleanup before delete on public.child_profiles
for each row execute function private.cleanup_shared_decorations_before_source_delete();

create or replace function private.cleanup_shared_decorations_for_catalog_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_world record;
begin
  for affected_world in
     select worlds.world_owner_child_profile_id, worlds.source_child_profile_id
       from (
         select distinct shared.world_owner_child_profile_id, shared.source_child_profile_id
           from public.child_shared_world_decorations shared
           join public.child_inventory_items inventory on inventory.id = shared.source_inventory_item_id
          where shared.is_active
            and inventory.catalog_item_id = old.id
       ) worlds
      order by least(worlds.source_child_profile_id, worlds.world_owner_child_profile_id), greatest(worlds.source_child_profile_id, worlds.world_owner_child_profile_id)
  loop
    perform private.lock_shared_decoration_pair(affected_world.source_child_profile_id, affected_world.world_owner_child_profile_id);
  end loop;
  for affected_world in
     select worlds.world_owner_child_profile_id, worlds.source_child_profile_id
       from (
         select distinct shared.world_owner_child_profile_id, shared.source_child_profile_id
           from public.child_shared_world_decorations shared
           join public.child_inventory_items inventory on inventory.id = shared.source_inventory_item_id
          where shared.is_active
            and inventory.catalog_item_id = old.id
       ) worlds
      order by worlds.world_owner_child_profile_id
  loop
    perform 1 from public.child_world_states state where state.child_profile_id = affected_world.world_owner_child_profile_id for update;
  end loop;
  for affected_world in
     select worlds.world_owner_child_profile_id, worlds.source_child_profile_id
       from (
         select distinct shared.world_owner_child_profile_id, shared.source_child_profile_id
           from public.child_shared_world_decorations shared
           join public.child_inventory_items inventory on inventory.id = shared.source_inventory_item_id
          where shared.is_active
            and inventory.catalog_item_id = old.id
       ) worlds
      order by worlds.world_owner_child_profile_id
  loop
    update public.child_shared_world_decorations shared
       set is_active = false, removed_reason = 'catalog_inactive'
     where shared.is_active
       and shared.world_owner_child_profile_id = affected_world.world_owner_child_profile_id
       and exists (
         select 1 from public.child_inventory_items inventory
          where inventory.id = shared.source_inventory_item_id
            and inventory.catalog_item_id = old.id
       );
    if found then
      update public.child_world_states state
         set revision = state.revision + 1
       where state.child_profile_id = affected_world.world_owner_child_profile_id;
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists game_catalog_shared_decorations_cleanup on public.game_catalog_items;
create trigger game_catalog_shared_decorations_cleanup
after update of is_active on public.game_catalog_items
for each row
when (old.is_active and not new.is_active)
execute function private.cleanup_shared_decorations_for_catalog_item();

create or replace function public.remove_friend(target_child_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid;
begin
  select id into actor from public.child_profiles where profile_id = (select auth.uid()) limit 1;
  if actor is null or actor = target_child_profile_id then
    raise exception 'friend not found or not authorized' using errcode = '42501';
  end if;
  perform 1 from public.child_profiles
   where id in (actor, target_child_profile_id)
   order by id
   for update;
  perform pg_advisory_xact_lock(hashtextextended(least(actor, target_child_profile_id)::text || ':' || greatest(actor, target_child_profile_id)::text, 0));
  update public.child_friendships set status = 'removed' where status = 'accepted' and ((child_profile_id = actor and friend_child_profile_id = target_child_profile_id) or (child_profile_id = target_child_profile_id and friend_child_profile_id = actor));
  if not found then raise exception 'friend not found or not authorized' using errcode = '42501'; end if;
  perform private.deactivate_shared_world_decorations_between(actor, target_child_profile_id, 'friendship_removed');
  delete from public.child_world_decoration_collaborators where (world_owner_child_profile_id = actor and collaborator_child_profile_id = target_child_profile_id) or (world_owner_child_profile_id = target_child_profile_id and collaborator_child_profile_id = actor);
end;
$$;
revoke all on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

create or replace function public.block_child(target_child_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid;
begin
  select id into actor from public.child_profiles where profile_id = (select auth.uid()) limit 1;
  if actor is null or actor = target_child_profile_id or not exists (select 1 from public.child_profiles where id = target_child_profile_id) then raise exception 'friend block could not be created' using errcode = '42501'; end if;
  perform 1 from public.child_profiles
   where id in (actor, target_child_profile_id)
   order by id
   for update;
  perform pg_advisory_xact_lock(hashtextextended(least(actor, target_child_profile_id)::text || ':' || greatest(actor, target_child_profile_id)::text, 0));
  insert into public.child_friend_blocks values (actor, target_child_profile_id) on conflict do nothing;
  update public.child_friendships set status = 'removed' where (child_profile_id = actor and friend_child_profile_id = target_child_profile_id) or (child_profile_id = target_child_profile_id and friend_child_profile_id = actor);
  update public.child_friend_requests set status = 'removed', updated_at = timezone('utc', now()) where status = 'pending' and ((requester_child_profile_id = actor and addressee_child_profile_id = target_child_profile_id) or (requester_child_profile_id = target_child_profile_id and addressee_child_profile_id = actor));
  perform private.deactivate_shared_world_decorations_between(actor, target_child_profile_id, 'blocked');
  delete from public.child_world_decoration_collaborators where (world_owner_child_profile_id = actor and collaborator_child_profile_id = target_child_profile_id) or (world_owner_child_profile_id = target_child_profile_id and collaborator_child_profile_id = actor);
end;
$$;
revoke all on function public.block_child(uuid) from public, anon;
grant execute on function public.block_child(uuid) to authenticated;

revoke all on function private.deactivate_shared_world_decorations_between(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.deactivate_shared_world_decorations_for_inventory(uuid) from public, anon, authenticated;
revoke all on function private.cleanup_shared_decorations_for_source(uuid) from public, anon, authenticated;
revoke all on function private.cleanup_shared_decorations_before_source_delete() from public, anon, authenticated;
revoke all on function private.cleanup_shared_decorations_before_inventory_delete() from public, anon, authenticated;
revoke all on function private.cleanup_shared_decorations_for_catalog_item() from public, anon, authenticated;
