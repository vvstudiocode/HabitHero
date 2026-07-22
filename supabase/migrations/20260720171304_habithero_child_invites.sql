-- One-time child-device invites. The raw token is returned only by the create
-- RPC; this table stores only its SHA-256 digest.

create table private.family_child_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  target_profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  check (expires_at > created_at),
  check (redeemed_at is null or revoked_at is null)
);

create unique index family_child_invites_one_open_target
  on private.family_child_invites (family_id, target_profile_id)
  where redeemed_at is null and revoked_at is null;

create index family_child_invites_target_idx
  on private.family_child_invites (target_profile_id, family_id);

alter table private.family_child_invites enable row level security;
revoke all on table private.family_child_invites from public, anon, authenticated;

create or replace function public.create_family_child_invite(
  p_target_family_id uuid,
  p_target_profile_id uuid,
  p_ttl_seconds integer default 900
)
returns table (
  invite_id uuid,
  token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  raw_token text;
  invite_expires_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_ttl_seconds not between 60 and 86400 then
    raise exception 'invite lifetime must be between 60 and 86400 seconds' using errcode = '22023';
  end if;
  if not private.is_family_parent(p_target_family_id) then
    raise exception 'family not found or not authorized' using errcode = '42501';
  end if;
  if p_target_profile_id = (select auth.uid()) then
    raise exception 'a parent cannot invite their own profile' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_target_profile_id) then
    raise exception 'target profile not found' using errcode = '23503';
  end if;
  if exists (
    select 1 from public.family_members m
    where m.family_id = p_target_family_id and m.profile_id = p_target_profile_id
  ) then
    raise exception 'target profile is already a family member' using errcode = '23505';
  end if;
  if exists (select 1 from public.child_profiles c where c.profile_id = p_target_profile_id) then
    raise exception 'target profile already has a child profile' using errcode = '23505';
  end if;

  -- A new invite supersedes any still-open invite for this family/profile.
  update private.family_child_invites
     set revoked_at = timezone('utc', now())
   where family_id = p_target_family_id
     and family_child_invites.target_profile_id = p_target_profile_id
     and redeemed_at is null
     and revoked_at is null;

  raw_token := encode(gen_random_bytes(32), 'hex');
  invite_expires_at := timezone('utc', now()) + (interval '1 second' * p_ttl_seconds);

  insert into private.family_child_invites (
    family_id, target_profile_id, token_hash, expires_at, created_by
  )
  values (
    p_target_family_id,
    p_target_profile_id,
    digest(raw_token, 'sha256'),
    invite_expires_at,
    (select auth.uid())
  )
  returning id into invite_id;

  token := raw_token;
  expires_at := invite_expires_at;
  return next;
end;
$$;

create or replace function public.redeem_family_child_invite(invite_token text)
returns table (
  family_id uuid,
  family_member_id uuid,
  child_profile_id uuid,
  redeemed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  invite_row private.family_child_invites;
  member_row public.family_members;
  child_row public.child_profiles;
  redemption_time timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if invite_token is null or invite_token !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'invite is invalid or unavailable' using errcode = '42501';
  end if;

  select i.* into invite_row
    from private.family_child_invites i
   where i.token_hash = digest(lower(invite_token), 'sha256')
   for update;

  if not found
     or invite_row.redeemed_at is not null
     or invite_row.revoked_at is not null
     or invite_row.expires_at <= timezone('utc', now())
     or invite_row.target_profile_id <> (select auth.uid()) then
    raise exception 'invite is invalid or unavailable' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = (select auth.uid())) then
    raise exception 'profile is required before joining a family' using errcode = '23503';
  end if;
  if exists (
    select 1 from public.family_members m
    where m.family_id = invite_row.family_id and m.profile_id = (select auth.uid())
  ) then
    raise exception 'profile is already a family member' using errcode = '23505';
  end if;
  if exists (select 1 from public.child_profiles c where c.profile_id = (select auth.uid())) then
    raise exception 'profile already has a child profile' using errcode = '23505';
  end if;

  insert into public.family_members (family_id, profile_id, role)
  values (invite_row.family_id, (select auth.uid()), 'child')
  returning * into member_row;

  insert into public.child_profiles (family_id, profile_id)
  values (invite_row.family_id, (select auth.uid()))
  returning * into child_row;

  redemption_time := timezone('utc', now());
  update private.family_child_invites
     set redeemed_at = redemption_time
   where id = invite_row.id;

  family_id := member_row.family_id;
  family_member_id := member_row.id;
  child_profile_id := child_row.id;
  redeemed_at := redemption_time;
  return next;
end;
$$;

revoke all on function public.create_family_child_invite(uuid, uuid, integer) from public, anon;
grant execute on function public.create_family_child_invite(uuid, uuid, integer) to authenticated;
revoke all on function public.redeem_family_child_invite(text) from public, anon;
grant execute on function public.redeem_family_child_invite(text) to authenticated;
;
