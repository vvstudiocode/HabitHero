-- Keep world revision hints available to visitors on the dedicated live
-- Presence/Broadcast channel after multiplayer moved off the chat topic.
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
    perform realtime.send(
      jsonb_build_object(
        'world_owner_child_profile_id', new.child_profile_id,
        'revision', new.revision
      ),
      'world_revision_v1',
      'friend-world-live:' || new.child_profile_id::text,
      true
    );
  end if;
  return new;
end;
$$;

revoke all on function private.broadcast_friend_world_revision() from public, anon, authenticated;
