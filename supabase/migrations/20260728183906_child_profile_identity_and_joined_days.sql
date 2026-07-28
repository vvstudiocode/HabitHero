-- Child identity is selected during creation and remains immutable. joined_at
-- is the source of truth for the dashboard's inclusive calendar-day counter.
alter table public.child_profiles
  add column if not exists gender text,
  add column if not exists character_id text,
  add column if not exists joined_at timestamptz not null default timezone('utc', now());

-- Existing rows predate character selection. Preserve them with an explicit
-- legacy value so the new columns can be required without changing history.
update public.child_profiles
   set gender = coalesce(gender, 'boy'),
       character_id = coalesce(nullif(trim(character_id), ''), 'legacy-default')
 where gender is null or character_id is null or char_length(trim(character_id)) = 0;

alter table public.child_profiles
  alter column gender set not null,
  alter column character_id set not null;

alter table public.child_profiles
  drop constraint if exists child_profiles_gender_check,
  drop constraint if exists child_profiles_character_id_check;

alter table public.child_profiles
  add constraint child_profiles_gender_check check (gender in ('boy', 'girl')),
  add constraint child_profiles_character_id_check check (char_length(trim(character_id)) between 1 and 80);

create or replace function private.enforce_child_identity_immutable()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'UPDATE'
     and (new.gender is distinct from old.gender or new.character_id is distinct from old.character_id) then
    raise exception 'child gender and character cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists child_profile_identity_guard on public.child_profiles;
create trigger child_profile_identity_guard
  before update on public.child_profiles
  for each row execute function private.enforce_child_identity_immutable();

revoke all on function private.enforce_child_identity_immutable() from public, anon, authenticated;

drop function if exists public.provision_child_account(uuid, text, text, uuid);
create function public.provision_child_account(
  target_family_id uuid,
  child_name text,
  target_login_name text,
  target_profile_id uuid,
  target_gender text,
  target_character_id text
)
returns public.child_profiles
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  child_row public.child_profiles;
  normalized_login_name text := lower(trim(target_login_name));
  normalized_character_id text := trim(target_character_id);
begin
  if (select auth.uid()) is null or not private.is_family_parent(target_family_id) then
    raise exception 'family not found or not authorized' using errcode = '42501';
  end if;
  if child_name is null or char_length(trim(child_name)) not between 1 and 80 then
    raise exception 'child name is invalid' using errcode = '22023';
  end if;
  if normalized_login_name !~ '^[a-z0-9][a-z0-9_]{2,31}$' then
    raise exception 'child account name is invalid' using errcode = '22023';
  end if;
  if target_gender not in ('boy', 'girl') then
    raise exception 'child gender is invalid' using errcode = '22023';
  end if;
  if normalized_character_id is null or char_length(normalized_character_id) not between 1 and 80 then
    raise exception 'child character is invalid' using errcode = '22023';
  end if;
  if target_profile_id is null or not exists (select 1 from auth.users where id = target_profile_id) then
    raise exception 'child auth account was not created' using errcode = '22023';
  end if;
  if exists (select 1 from public.child_profiles where login_name = normalized_login_name) then
    raise exception 'child account name is already in use' using errcode = '23505';
  end if;

  insert into public.profiles (id, display_name)
  values (target_profile_id, trim(child_name))
  on conflict (id) do update set display_name = excluded.display_name;
  insert into public.family_members (family_id, profile_id, role)
  values (target_family_id, target_profile_id, 'child');
  insert into public.child_profiles (family_id, profile_id, display_name, login_name, gender, character_id)
  values (target_family_id, target_profile_id, trim(child_name), normalized_login_name, target_gender, normalized_character_id)
  returning * into child_row;
  return child_row;
end;
$$;

revoke all on function public.provision_child_account(uuid, text, text, uuid, text, text) from public, anon;
grant execute on function public.provision_child_account(uuid, text, text, uuid, text, text) to authenticated;

-- Keep the legacy password RPC safe if called directly by another backend.
drop function if exists public.create_child_profile(uuid, text, text);
create function public.create_child_profile(
  target_family_id uuid,
  child_name text,
  child_password text,
  target_gender text,
  target_character_id text
)
returns public.child_profiles
language plpgsql security definer
set search_path = extensions, pg_catalog, public
as $$
declare
  child_row public.child_profiles;
begin
  if (select auth.uid()) is null or not private.is_family_parent(target_family_id) then
    raise exception 'family not found or not authorized' using errcode = '42501';
  end if;
  if child_name is null or char_length(trim(child_name)) not between 1 and 80
     or child_password is null or child_password !~ '^[A-Za-z0-9]{6,}$'
     or target_gender not in ('boy', 'girl')
     or target_character_id is null or char_length(trim(target_character_id)) not between 1 and 80 then
    raise exception 'invalid child profile details' using errcode = '22023';
  end if;
  insert into public.child_profiles (family_id, profile_id, display_name, gender, character_id)
  values (target_family_id, null, trim(child_name), target_gender, trim(target_character_id))
  returning * into child_row;
  insert into private.child_passwords (child_profile_id, password_hash)
  values (child_row.id, crypt(child_password, gen_salt('bf', 10)));
  return child_row;
end;
$$;

revoke all on function public.create_child_profile(uuid, text, text, text, text) from public, anon, authenticated;
