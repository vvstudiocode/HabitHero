-- Phase 1: child-led friendship relationships. No durable room or position data.
create table public.child_friend_codes (
  child_profile_id uuid primary key references public.child_profiles(id) on delete cascade,
  code_normalized text not null check (code_normalized ~ '^[A-Z0-9]{32}$'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (code_normalized)
);

create table public.child_friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  addressee_child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'removed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (requester_child_profile_id <> addressee_child_profile_id)
);
create unique index child_friend_requests_pending_pair_idx on public.child_friend_requests (requester_child_profile_id, addressee_child_profile_id) where status = 'pending';

create table public.child_friendships (
  child_low_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  child_high_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  friend_child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  status text not null default 'accepted' check (status in ('accepted', 'pending', 'declined', 'removed')),
  created_at timestamptz not null default timezone('utc', now()),
  check (child_low_profile_id < child_high_profile_id),
  check (child_profile_id <> friend_child_profile_id),
  check (child_low_profile_id = least(child_profile_id, friend_child_profile_id)),
  check (child_high_profile_id = greatest(child_profile_id, friend_child_profile_id)),
  unique (child_low_profile_id, child_high_profile_id)
);

create table public.child_friend_blocks (
  blocker_child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  blocked_child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (blocker_child_profile_id, blocked_child_profile_id),
  check (blocker_child_profile_id <> blocked_child_profile_id)
);

alter table public.child_friend_codes enable row level security;
alter table public.child_friend_requests enable row level security;
alter table public.child_friendships enable row level security;
alter table public.child_friend_blocks enable row level security;
revoke all on table public.child_friend_codes from public, anon, authenticated;
revoke all on table public.child_friend_requests from public, anon, authenticated;
revoke all on table public.child_friendships from public, anon, authenticated;
revoke all on table public.child_friend_blocks from public, anon, authenticated;
grant select on table public.child_friend_codes to authenticated;
grant select on table public.child_friend_requests to authenticated;
grant select on table public.child_friendships to authenticated;
grant select on table public.child_friend_blocks to authenticated;

create policy child_friend_codes_select on public.child_friend_codes for select to authenticated
  using (private.is_child_owner((select family_id from public.child_profiles where id = child_profile_id), child_profile_id)
    or private.is_family_parent((select family_id from public.child_profiles where id = child_profile_id)));
create policy child_friend_requests_select on public.child_friend_requests for select to authenticated
  using (private.is_child_owner((select family_id from public.child_profiles where id = requester_child_profile_id), requester_child_profile_id)
    or private.is_child_owner((select family_id from public.child_profiles where id = addressee_child_profile_id), addressee_child_profile_id)
    or private.is_family_parent((select family_id from public.child_profiles where id = requester_child_profile_id))
    or private.is_family_parent((select family_id from public.child_profiles where id = addressee_child_profile_id)));
create policy child_friendships_select on public.child_friendships for select to authenticated
  using (private.is_child_owner((select family_id from public.child_profiles where id = child_profile_id), child_profile_id)
    or private.is_child_owner((select family_id from public.child_profiles where id = friend_child_profile_id), friend_child_profile_id)
    or private.is_family_parent((select family_id from public.child_profiles where id = child_profile_id))
    or private.is_family_parent((select family_id from public.child_profiles where id = friend_child_profile_id)));
create policy child_friend_blocks_select on public.child_friend_blocks for select to authenticated
  using (private.is_child_owner((select family_id from public.child_profiles where id = blocker_child_profile_id), blocker_child_profile_id)
    or private.is_family_parent((select family_id from public.child_profiles where id = blocker_child_profile_id)));

create or replace function public.get_my_friend_code() returns text language plpgsql security definer set search_path = extensions, pg_catalog, public as $$
declare actor uuid; value text;
begin
  select id into actor from public.child_profiles where profile_id = (select auth.uid()) limit 1;
  if actor is null then raise exception 'friend code unavailable' using errcode = '42501'; end if;
  insert into public.child_friend_codes(child_profile_id, code_normalized) values (actor, upper(encode(gen_random_bytes(16), 'hex')))
    on conflict (child_profile_id) do nothing;
  select code_normalized into value from public.child_friend_codes where child_profile_id = actor;
  return value;
end $$;
revoke all on function public.get_my_friend_code() from public, anon; grant execute on function public.get_my_friend_code() to authenticated;

create or replace function public.list_my_friends()
returns table(child_profile_id uuid, display_name text, is_online boolean, world_revision bigint)
language sql security definer set search_path = extensions, pg_catalog, public as $$
  select case when friendship.child_profile_id = actor.id then friendship.friend_child_profile_id else friendship.child_profile_id end,
         target.display_name,
         false,
         coalesce(world.revision, 0)
    from public.child_friendships friendship
    join public.child_profiles actor on actor.profile_id = (select auth.uid())
    join public.child_profiles target on target.id = case when friendship.child_profile_id = actor.id then friendship.friend_child_profile_id else friendship.child_profile_id end
    left join public.child_world_states world on world.child_profile_id = target.id
   where friendship.status = 'accepted'
     and (friendship.child_profile_id = actor.id or friendship.friend_child_profile_id = actor.id);
$$;
revoke all on function public.list_my_friends() from public, anon; grant execute on function public.list_my_friends() to authenticated;

create or replace function public.list_my_friend_requests() returns table(id uuid, direction text, child_profile_id uuid, display_name text, created_at timestamptz) language sql security definer set search_path = extensions, pg_catalog, public as $$
  select request.id, case when request.requester_child_profile_id = actor.id then 'outgoing' else 'incoming' end, case when request.requester_child_profile_id = actor.id then request.addressee_child_profile_id else request.requester_child_profile_id end, target.display_name, request.created_at
  from public.child_friend_requests request join public.child_profiles actor on actor.profile_id = (select auth.uid()) join public.child_profiles target on target.id = case when request.requester_child_profile_id = actor.id then request.addressee_child_profile_id else request.requester_child_profile_id end
  where request.status = 'pending' and (request.requester_child_profile_id = actor.id or request.addressee_child_profile_id = actor.id);
$$;
revoke all on function public.list_my_friend_requests() from public, anon; grant execute on function public.list_my_friend_requests() to authenticated;

create or replace function public.send_friend_request(target_friend_code text) returns public.child_friend_requests language plpgsql security definer set search_path = extensions, pg_catalog, public as $$
declare actor uuid; target uuid; result public.child_friend_requests;
begin
  select id into actor from public.child_profiles where profile_id = (select auth.uid()) limit 1;
  select child_profile_id into target from public.child_friend_codes where code_normalized = upper(regexp_replace(trim(coalesce(target_friend_code, '')), '[[:space:]-]', '', 'g'));
  if actor is null or target is null or actor = target or exists (select 1 from public.child_friend_blocks b where (b.blocker_child_profile_id = actor and b.blocked_child_profile_id = target) or (b.blocker_child_profile_id = target and b.blocked_child_profile_id = actor)) then raise exception 'friend request could not be created' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(actor, target)::text || ':' || greatest(actor, target)::text, 0));
  perform 1 from public.child_profiles where id in (actor, target) for update;
  if exists (select 1 from public.child_friend_blocks b where (b.blocker_child_profile_id = actor and b.blocked_child_profile_id = target) or (b.blocker_child_profile_id = target and b.blocked_child_profile_id = actor)) then raise exception 'friend request could not be created' using errcode = '42501'; end if;
  if (select count(*) from public.child_friendships f where f.status = 'accepted' and (f.child_profile_id = actor or f.friend_child_profile_id = actor)) >= 50 then raise exception 'friend request could not be created' using errcode = 'P0001'; end if;
  if (select count(*) from public.child_friend_requests r where r.requester_child_profile_id = actor and r.status = 'pending') >= 20
     or (select count(*) from public.child_friend_requests r where r.addressee_child_profile_id = target and r.status = 'pending') >= 20
     or exists (select 1 from public.child_friend_requests r where r.status = 'pending' and ((r.requester_child_profile_id = actor and r.addressee_child_profile_id = target) or (r.requester_child_profile_id = target and r.addressee_child_profile_id = actor)))
     or exists (select 1 from public.child_friendships f where f.status = 'accepted' and ((f.child_profile_id = actor and f.friend_child_profile_id = target) or (f.child_profile_id = target and f.friend_child_profile_id = actor))) then
    raise exception 'friend request could not be created' using errcode = 'P0001';
  end if;
  insert into public.child_friend_requests(requester_child_profile_id, addressee_child_profile_id) values (actor, target) returning * into result;
  return result;
exception when unique_violation then raise exception 'friend request could not be created' using errcode = 'P0001';
end $$;
revoke all on function public.send_friend_request(text) from public, anon; grant execute on function public.send_friend_request(text) to authenticated;

create or replace function public.accept_friend_request(target_request_id uuid) returns public.child_friendships language plpgsql security definer set search_path = extensions, pg_catalog, public as $$
declare actor uuid; request_row public.child_friend_requests; result public.child_friendships; low_id uuid; high_id uuid;
begin
  select id into actor from public.child_profiles where profile_id = (select auth.uid()) limit 1;
  select * into request_row from public.child_friend_requests where id = target_request_id and addressee_child_profile_id = actor and status = 'pending';
  if not found then raise exception 'friend request could not be accepted' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(request_row.requester_child_profile_id, request_row.addressee_child_profile_id)::text || ':' || greatest(request_row.requester_child_profile_id, request_row.addressee_child_profile_id)::text, 0));
  perform 1 from public.child_profiles where id in (request_row.requester_child_profile_id, request_row.addressee_child_profile_id) for update;
  select * into request_row from public.child_friend_requests where id = target_request_id and addressee_child_profile_id = actor and status = 'pending' for update;
  if not found then raise exception 'friend request could not be accepted' using errcode = '42501'; end if;
  if exists (select 1 from public.child_friend_blocks b where (b.blocker_child_profile_id = actor and b.blocked_child_profile_id = request_row.requester_child_profile_id) or (b.blocker_child_profile_id = request_row.requester_child_profile_id and b.blocked_child_profile_id = actor))
     or (select count(*) from public.child_friendships f where f.status = 'accepted' and (f.child_profile_id = actor or f.friend_child_profile_id = actor)) >= 50
     or (select count(*) from public.child_friendships f where f.status = 'accepted' and (f.child_profile_id = request_row.requester_child_profile_id or f.friend_child_profile_id = request_row.requester_child_profile_id)) >= 50
     then
    raise exception 'friend request could not be accepted' using errcode = 'P0001';
  end if;
  low_id := least(request_row.requester_child_profile_id, request_row.addressee_child_profile_id); high_id := greatest(request_row.requester_child_profile_id, request_row.addressee_child_profile_id);
  insert into public.child_friendships(child_low_profile_id, child_high_profile_id, child_profile_id, friend_child_profile_id) values (low_id, high_id, request_row.requester_child_profile_id, request_row.addressee_child_profile_id) on conflict (child_low_profile_id, child_high_profile_id) do update set status = 'accepted' returning * into result;
  update public.child_friend_requests set status = 'accepted', updated_at = timezone('utc', now()) where id = request_row.id;
  return result;
end $$;
revoke all on function public.accept_friend_request(uuid) from public, anon; grant execute on function public.accept_friend_request(uuid) to authenticated;

create or replace function public.decline_friend_request(target_request_id uuid) returns void language plpgsql security definer set search_path = extensions, pg_catalog, public as $$
begin update public.child_friend_requests set status = 'declined', updated_at = timezone('utc', now()) where id = target_request_id and addressee_child_profile_id = (select id from public.child_profiles where profile_id = (select auth.uid()) limit 1) and status = 'pending'; if not found then raise exception 'friend request not found or not authorized' using errcode = '42501'; end if; end $$;
revoke all on function public.decline_friend_request(uuid) from public, anon; grant execute on function public.decline_friend_request(uuid) to authenticated;

create or replace function public.remove_friend(target_child_profile_id uuid) returns void language plpgsql security definer set search_path = extensions, pg_catalog, public as $$
declare actor uuid; begin select id into actor from public.child_profiles where profile_id = (select auth.uid()) limit 1; update public.child_friendships set status = 'removed' where status = 'accepted' and ((child_profile_id = actor and friend_child_profile_id = target_child_profile_id) or (child_profile_id = target_child_profile_id and friend_child_profile_id = actor)); if not found then raise exception 'friend not found or not authorized' using errcode = '42501'; end if; end $$;
revoke all on function public.remove_friend(uuid) from public, anon; grant execute on function public.remove_friend(uuid) to authenticated;

create or replace function public.block_child(target_child_profile_id uuid) returns void language plpgsql security definer set search_path = extensions, pg_catalog, public as $$
declare actor uuid; begin select id into actor from public.child_profiles where profile_id = (select auth.uid()) limit 1; if actor is null or actor = target_child_profile_id or not exists (select 1 from public.child_profiles where id = target_child_profile_id) then raise exception 'friend block could not be created' using errcode = '42501'; end if; perform pg_advisory_xact_lock(hashtextextended(least(actor, target_child_profile_id)::text || ':' || greatest(actor, target_child_profile_id)::text, 0)); perform 1 from public.child_profiles where id in (actor, target_child_profile_id) for update; insert into public.child_friend_blocks values (actor, target_child_profile_id) on conflict do nothing; update public.child_friendships set status = 'removed' where (child_profile_id = actor and friend_child_profile_id = target_child_profile_id) or (child_profile_id = target_child_profile_id and friend_child_profile_id = actor); update public.child_friend_requests set status = 'removed', updated_at = timezone('utc', now()) where status = 'pending' and ((requester_child_profile_id = actor and addressee_child_profile_id = target_child_profile_id) or (requester_child_profile_id = target_child_profile_id and addressee_child_profile_id = actor)); end $$;
revoke all on function public.block_child(uuid) from public, anon; grant execute on function public.block_child(uuid) to authenticated;
