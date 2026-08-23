-- Phase 4: persistent, server-authoritative chat for a friend world.
-- Friendship and private-channel authorization are owned by the friends/world
-- phases. This migration consumes private.can_visit_friend_world(uuid, uuid)
-- so chat cannot drift from the canonical friendship/block rules.
-- The canonical relationship tables are child_friendships and
-- child_friend_blocks; no chat table is allowed to create a second friendship
-- or block authority.

create table public.friend_world_messages (
  id uuid primary key default gen_random_uuid(),
  world_owner_child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  sender_child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  sender_display_name text not null check (char_length(trim(sender_display_name)) between 1 and 80),
  body text not null check (char_length(trim(body)) between 1 and 120),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default timezone('utc', now())
);

create index friend_world_messages_world_created_idx
  on public.friend_world_messages (world_owner_child_profile_id, created_at desc, id desc);
create index friend_world_messages_sender_window_idx
  on public.friend_world_messages (sender_child_profile_id, world_owner_child_profile_id, created_at desc);

create table public.friend_world_message_reads (
  id uuid primary key default gen_random_uuid(),
  world_owner_child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  reader_child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  last_read_message_id uuid references public.friend_world_messages(id) on delete set null,
  last_read_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (world_owner_child_profile_id, reader_child_profile_id)
);

create index friend_world_message_reads_reader_idx
  on public.friend_world_message_reads (reader_child_profile_id, world_owner_child_profile_id);

create table public.friend_world_message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.friend_world_messages(id) on delete restrict,
  reporter_child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  reason text not null default '未提供原因' check (char_length(trim(reason)) between 1 and 500),
  created_at timestamptz not null default timezone('utc', now()),
  unique (message_id, reporter_child_profile_id)
);

create index friend_world_message_reports_message_idx
  on public.friend_world_message_reports (message_id, created_at desc);

create or replace function private.friend_world_current_child_profile_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select c.id
    from public.child_profiles c
   where c.profile_id = (select auth.uid())
   limit 1;
$$;

revoke all on function private.friend_world_current_child_profile_id() from public, anon;
grant execute on function private.friend_world_current_child_profile_id() to authenticated;

create or replace function private.can_friend_world_chat(
  requester_user_id uuid,
  world_owner_child_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select requester_user_id is not null
     and exists (
       select 1
         from public.child_profiles requester
        where requester.profile_id = requester_user_id
     )
     and private.can_visit_friend_world(requester_user_id, world_owner_child_profile_id);
$$;

revoke all on function private.can_friend_world_chat(uuid, uuid) from public, anon;
grant execute on function private.can_friend_world_chat(uuid, uuid) to authenticated;

create or replace function private.validate_friend_world_message_body(message_text text)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  normalized text := btrim(coalesce(message_text, ''));
begin
  if char_length(normalized) not between 1 and 120
     or normalized ~ '[[:cntrl:]]'
     or normalized ~* '(^|[^[:alnum:]_])((https?://)|(www[.]))'
     or normalized ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}'
     or normalized ~ '(^|[^0-9])(\+?[0-9][0-9 .()/-]{5,}[0-9])([^0-9]|$)' then
    raise exception 'chat message unavailable' using errcode = '22023';
  end if;
  return normalized;
end;
$$;

revoke all on function private.validate_friend_world_message_body(text) from public, anon, authenticated;

create or replace function private.enforce_friend_world_message_canonical_fields()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  canonical_name text;
begin
  new.body := private.validate_friend_world_message_body(new.body);
  select c.display_name into canonical_name
    from public.child_profiles c
   where c.id = new.sender_child_profile_id;
  if canonical_name is null or new.sender_display_name is distinct from canonical_name then
    raise exception 'chat message unavailable' using errcode = '42501';
  end if;
  new.created_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists friend_world_messages_canonical_guard on public.friend_world_messages;
create trigger friend_world_messages_canonical_guard
  before insert on public.friend_world_messages
  for each row execute function private.enforce_friend_world_message_canonical_fields();

create or replace function private.touch_friend_world_message_read()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists friend_world_message_reads_updated_at on public.friend_world_message_reads;
create trigger friend_world_message_reads_updated_at
  before update on public.friend_world_message_reads
  for each row execute function private.touch_friend_world_message_read();

alter table public.friend_world_messages enable row level security;
alter table public.friend_world_message_reads enable row level security;
alter table public.friend_world_message_reports enable row level security;

revoke all on table public.friend_world_messages from public, anon, authenticated;
revoke all on table public.friend_world_message_reads from public, anon, authenticated;
revoke all on table public.friend_world_message_reports from public, anon, authenticated;
grant select on table public.friend_world_messages to authenticated;
grant select on table public.friend_world_message_reads to authenticated;
grant select on table public.friend_world_message_reports to authenticated;

create policy friend_world_messages_select on public.friend_world_messages
  for select to authenticated
  using (private.can_friend_world_chat((select auth.uid()), world_owner_child_profile_id));

create policy friend_world_message_reads_select on public.friend_world_message_reads
  for select to authenticated
  using (
    reader_child_profile_id = private.friend_world_current_child_profile_id()
    and private.can_friend_world_chat((select auth.uid()), world_owner_child_profile_id)
  );

create policy friend_world_message_reports_select on public.friend_world_message_reports
  for select to authenticated
  using (
    reporter_child_profile_id = private.friend_world_current_child_profile_id()
    or exists (
      select 1
        from public.friend_world_messages message_row
        join public.child_profiles owner_child on owner_child.id = message_row.world_owner_child_profile_id
       where message_row.id = friend_world_message_reports.message_id
         and private.is_family_parent(owner_child.family_id)
    )
  );

create or replace function public.send_friend_world_message(
  target_world_owner_child_profile_id uuid,
  message_text text
)
returns public.friend_world_messages
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  sender_child_id uuid;
  sender_name text;
  normalized_body text;
  inserted_message public.friend_world_messages;
begin
  if (select auth.uid()) is null then
    raise exception 'chat message unavailable' using errcode = '42501';
  end if;

  select c.id, c.display_name
    into sender_child_id, sender_name
    from public.child_profiles c
   where c.profile_id = (select auth.uid());
  if sender_child_id is null
     or not private.can_friend_world_chat((select auth.uid()), target_world_owner_child_profile_id) then
    raise exception 'chat message unavailable' using errcode = '42501';
  end if;

  normalized_body := private.validate_friend_world_message_body(message_text);

  -- Serialize the sender/world bucket so concurrent requests cannot both pass
  -- the count checks before either row is visible to the other transaction.
  perform pg_advisory_xact_lock(hashtextextended(
    sender_child_id::text || ':' || target_world_owner_child_profile_id::text,
    0
  ));

  if (
    select count(*)
      from public.friend_world_messages m
     where m.sender_child_profile_id = sender_child_id
       and m.world_owner_child_profile_id = target_world_owner_child_profile_id
       and m.created_at >= timezone('utc', now()) - interval '10 seconds'
  ) >= 5
  or (
    select count(*)
      from public.friend_world_messages m
     where m.sender_child_profile_id = sender_child_id
       and m.world_owner_child_profile_id = target_world_owner_child_profile_id
       and m.created_at >= timezone('utc', now()) - interval '1 minute'
  ) >= 30 then
    raise exception 'chat message unavailable' using errcode = 'P0001';
  end if;

  insert into public.friend_world_messages (
    world_owner_child_profile_id,
    sender_child_profile_id,
    sender_display_name,
    body
  ) values (
    target_world_owner_child_profile_id,
    sender_child_id,
    sender_name,
    normalized_body
  )
  returning * into inserted_message;

  return inserted_message;
end;
$$;

revoke all on function public.send_friend_world_message(uuid, text) from public, anon;
grant execute on function public.send_friend_world_message(uuid, text) to authenticated;

create or replace function public.mark_friend_world_messages_read(
  target_world_owner_child_profile_id uuid,
  target_message_id uuid default null
)
returns public.friend_world_message_reads
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  reader_child_id uuid;
  target_read_at timestamptz := timezone('utc', now());
  existing_read public.friend_world_message_reads;
begin
  reader_child_id := private.friend_world_current_child_profile_id();
  if reader_child_id is null
     or not private.can_friend_world_chat((select auth.uid()), target_world_owner_child_profile_id) then
    raise exception 'chat message unavailable' using errcode = '42501';
  end if;

  if target_message_id is not null then
    select m.created_at into target_read_at
      from public.friend_world_messages m
     where m.id = target_message_id
       and m.world_owner_child_profile_id = target_world_owner_child_profile_id
       and m.status = 'visible';
    if target_read_at is null then
      raise exception 'chat message unavailable' using errcode = '42501';
    end if;
  end if;

  insert into public.friend_world_message_reads (
    world_owner_child_profile_id,
    reader_child_profile_id,
    last_read_message_id,
    last_read_at
  ) values (
    target_world_owner_child_profile_id,
    reader_child_id,
    target_message_id,
    target_read_at
  )
  on conflict (world_owner_child_profile_id, reader_child_profile_id)
  do update set
    last_read_message_id = case
      when excluded.last_read_at >= friend_world_message_reads.last_read_at
      then excluded.last_read_message_id
      else friend_world_message_reads.last_read_message_id
    end,
    last_read_at = greatest(friend_world_message_reads.last_read_at, excluded.last_read_at)
  returning * into existing_read;

  return existing_read;
end;
$$;

revoke all on function public.mark_friend_world_messages_read(uuid, uuid) from public, anon;
grant execute on function public.mark_friend_world_messages_read(uuid, uuid) to authenticated;

create or replace function public.report_friend_world_message(
  target_message_id uuid,
  report_reason text default '未提供原因'
)
returns public.friend_world_message_reports
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  reporter_child_id uuid;
  target_owner_id uuid;
  normalized_reason text := btrim(coalesce(report_reason, '未提供原因'));
  inserted_report public.friend_world_message_reports;
begin
  reporter_child_id := private.friend_world_current_child_profile_id();
  select m.world_owner_child_profile_id into target_owner_id
    from public.friend_world_messages m
   where m.id = target_message_id
     and m.status = 'visible';
  if reporter_child_id is null
     or target_owner_id is null
     or not private.can_friend_world_chat((select auth.uid()), target_owner_id) then
    raise exception 'chat message unavailable' using errcode = '42501';
  end if;
  if char_length(normalized_reason) not between 1 and 500
     or normalized_reason ~ '[[:cntrl:]]' then
    raise exception 'chat message unavailable' using errcode = '22023';
  end if;

  insert into public.friend_world_message_reports (message_id, reporter_child_profile_id, reason)
  values (target_message_id, reporter_child_id, normalized_reason)
  on conflict (message_id, reporter_child_profile_id)
  do update set reason = excluded.reason
  returning * into inserted_report;
  return inserted_report;
end;
$$;

revoke all on function public.report_friend_world_message(uuid, text) from public, anon;
grant execute on function public.report_friend_world_message(uuid, text) to authenticated;

create or replace function public.get_friend_world_message_unread_count(
  target_world_owner_child_profile_id uuid
)
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select count(*)::integer
    from public.friend_world_messages m
    left join public.friend_world_message_reads r
      on r.world_owner_child_profile_id = m.world_owner_child_profile_id
     and r.reader_child_profile_id = private.friend_world_current_child_profile_id()
   where m.world_owner_child_profile_id = target_world_owner_child_profile_id
     and m.status = 'visible'
     and m.sender_child_profile_id <> private.friend_world_current_child_profile_id()
     and m.created_at > coalesce(r.last_read_at, to_timestamp(0))
     and private.can_friend_world_chat((select auth.uid()), target_world_owner_child_profile_id);
$$;

revoke all on function public.get_friend_world_message_unread_count(uuid) from public, anon;
grant execute on function public.get_friend_world_message_unread_count(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.friend_world_messages;
    exception when duplicate_object then
      null;
    end;
  end if;
end;
$$;
