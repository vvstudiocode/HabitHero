alter table public.child_friend_requests replica identity full;
alter table public.child_friendships replica identity full;

do $$
begin
  begin
    alter publication supabase_realtime add table public.child_friend_requests;
  exception when duplicate_object then
    null;
  end;
  begin
    alter publication supabase_realtime add table public.child_friendships;
  exception when duplicate_object then
    null;
  end;
end;
$$;

create or replace function public.send_friend_request(target_friend_code text)
returns public.child_friend_requests
language plpgsql
security definer
set search_path = extensions, pg_catalog, public
as $$
declare
  actor uuid;
  target uuid;
  result public.child_friend_requests;
  normalized_input text := lower(trim(coalesce(target_friend_code, '')));
begin
  select id into actor from public.child_profiles where profile_id = (select auth.uid()) limit 1;
  select id into target from public.child_profiles where lower(login_name) = normalized_input;
  if target is null then
    select child_profile_id into target
      from public.child_friend_codes
     where code_normalized = upper(regexp_replace(trim(coalesce(target_friend_code, '')), '[[:space:]-]', '', 'g'));
  end if;
  if actor is null or target is null or actor = target or exists (
    select 1 from public.child_friend_blocks b
     where (b.blocker_child_profile_id = actor and b.blocked_child_profile_id = target)
        or (b.blocker_child_profile_id = target and b.blocked_child_profile_id = actor)
  ) then raise exception 'friend request could not be created' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(actor, target)::text || ':' || greatest(actor, target)::text, 0));
  perform 1 from public.child_profiles where id in (actor, target) for update;
  if exists (
    select 1 from public.child_friend_blocks b
     where (b.blocker_child_profile_id = actor and b.blocked_child_profile_id = target)
        or (b.blocker_child_profile_id = target and b.blocked_child_profile_id = actor)
  ) then raise exception 'friend request could not be created' using errcode = '42501'; end if;
  if (select count(*) from public.child_friendships f where f.status = 'accepted' and (f.child_profile_id = actor or f.friend_child_profile_id = actor)) >= 50
     or (select count(*) from public.child_friend_requests r where r.requester_child_profile_id = actor and r.status = 'pending') >= 20
     or (select count(*) from public.child_friend_requests r where r.addressee_child_profile_id = target and r.status = 'pending') >= 20 then
    raise exception 'friend request could not be created' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.child_friend_requests r where r.status = 'pending' and r.requester_child_profile_id = actor and r.addressee_child_profile_id = target) then
    raise exception 'friend request already sent' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.child_friend_requests r where r.status = 'pending' and r.requester_child_profile_id = target and r.addressee_child_profile_id = actor) then
    raise exception 'friend request received' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.child_friendships f where f.status = 'accepted' and ((f.child_profile_id = actor and f.friend_child_profile_id = target) or (f.child_profile_id = target and f.friend_child_profile_id = actor))) then
    raise exception 'already friends' using errcode = 'P0001';
  end if;
  insert into public.child_friend_requests(requester_child_profile_id, addressee_child_profile_id)
  values (actor, target)
  returning * into result;
  return result;
exception when unique_violation then
  raise exception 'friend request already sent' using errcode = 'P0001';
end $$;
revoke all on function public.send_friend_request(text) from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;
