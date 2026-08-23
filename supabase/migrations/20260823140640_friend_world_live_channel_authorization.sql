-- Keep low-latency avatar Presence/Broadcast traffic separate from the
-- friend-world chat and co-op Postgres Changes channel. The client must use
-- private: true; there is intentionally no public-channel fallback.

create policy friend_world_live_broadcast_select
on realtime.messages
for select to authenticated
using (
  extension = 'broadcast'
  and realtime.topic() ~ '^friend-world-live:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and private.can_visit_friend_world(
    (select auth.uid()),
    case when realtime.topic() like 'friend-world-live:%'
      then split_part(realtime.topic(), 'friend-world-live:', 2)::uuid
      else null
    end
  )
);

create policy friend_world_live_broadcast_insert
on realtime.messages
for insert to authenticated
with check (
  extension = 'broadcast'
  and realtime.topic() ~ '^friend-world-live:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and private.can_visit_friend_world(
    (select auth.uid()),
    case when realtime.topic() like 'friend-world-live:%'
      then split_part(realtime.topic(), 'friend-world-live:', 2)::uuid
      else null
    end
  )
);

create policy friend_world_live_presence_select
on realtime.messages
for select to authenticated
using (
  extension = 'presence'
  and realtime.topic() ~ '^friend-world-live:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and private.can_visit_friend_world(
    (select auth.uid()),
    case when realtime.topic() like 'friend-world-live:%'
      then split_part(realtime.topic(), 'friend-world-live:', 2)::uuid
      else null
    end
  )
);

create policy friend_world_live_presence_insert
on realtime.messages
for insert to authenticated
with check (
  extension = 'presence'
  and realtime.topic() ~ '^friend-world-live:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and private.can_visit_friend_world(
    (select auth.uid()),
    case when realtime.topic() like 'friend-world-live:%'
      then split_part(realtime.topic(), 'friend-world-live:', 2)::uuid
      else null
    end
  )
);
