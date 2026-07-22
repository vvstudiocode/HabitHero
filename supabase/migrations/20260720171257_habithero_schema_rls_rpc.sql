-- HabitHero core schema, RLS, and transaction-safe point mutations.
-- This migration intentionally does not create or seed auth.users records.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('parent', 'child')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (family_id, profile_id),
  unique (family_id, profile_id, role)
);

create unique index family_members_one_family_per_profile
  on public.family_members (profile_id)
  where role = 'child';

create table public.child_profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  points_balance integer not null default 0 check (points_balance >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (profile_id),
  unique (family_id, id),
  unique (family_id, profile_id),
  foreign key (family_id, profile_id)
    references public.family_members (family_id, profile_id)
    on delete cascade
);

create table public.task_templates (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  points integer not null check (points > 0),
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 1440),
  icon text not null check (char_length(trim(icon)) between 1 and 32),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (family_id, id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_profile_id uuid not null,
  template_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 120),
  points integer not null check (points > 0),
  status text not null default 'todo' check (status in ('todo', 'pending', 'completed')),
  icon text not null check (char_length(trim(icon)) between 1 and 32),
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 1440),
  is_daily boolean not null default false,
  due_on date,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (family_id, id),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id)
    on delete cascade,
  foreign key (family_id, template_id)
    references public.task_templates (family_id, id)
    on delete set null,
  check ((status = 'todo' and completed_at is null) or (status in ('pending', 'completed') and completed_at is not null))
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_profile_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  points integer not null check (points > 0),
  icon text not null check (char_length(trim(icon)) between 1 and 32),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (family_id, id),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id)
    on delete cascade
);

create table public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_profile_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 120),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id)
    on delete cascade
);

create table public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_profile_id uuid not null,
  reward_id uuid not null,
  reward_name text not null,
  reward_icon text not null,
  points_cost integer not null check (points_cost > 0),
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'cancelled')),
  created_at timestamptz not null default timezone('utc', now()),
  fulfilled_at timestamptz,
  unique (family_id, id),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id)
    on delete cascade,
  foreign key (family_id, reward_id)
    references public.rewards (family_id, id)
    on delete restrict,
  check ((status = 'fulfilled' and fulfilled_at is not null) or (status <> 'fulfilled' and fulfilled_at is null))
);

create table public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_profile_id uuid not null,
  task_id uuid,
  redemption_id uuid,
  entry_type text not null check (entry_type in ('task_approved', 'reward_redemption', 'manual_adjustment')),
  points_delta integer not null check (points_delta <> 0),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id)
    on delete cascade,
  foreign key (family_id, task_id)
    references public.tasks (family_id, id)
    on delete restrict,
  foreign key (family_id, redemption_id)
    references public.reward_redemptions (family_id, id)
    on delete restrict,
  unique (task_id) deferrable initially immediate,
  unique (redemption_id) deferrable initially immediate,
  check (
    (entry_type = 'task_approved' and task_id is not null and redemption_id is null and points_delta > 0)
    or (entry_type = 'reward_redemption' and task_id is null and redemption_id is not null and points_delta < 0)
    or (entry_type = 'manual_adjustment' and task_id is null and redemption_id is null)
  )
);

create index family_members_profile_idx on public.family_members (profile_id);
create index child_profiles_family_idx on public.child_profiles (family_id);
create index task_templates_family_sort_idx on public.task_templates (family_id, sort_order);
create index tasks_family_child_status_idx on public.tasks (family_id, child_profile_id, status);
create index tasks_due_idx on public.tasks (family_id, due_on) where due_on is not null;
create index rewards_family_child_sort_idx on public.rewards (family_id, child_profile_id, sort_order);
create index wishlist_family_child_idx on public.wishlist_items (family_id, child_profile_id);
create index redemptions_family_child_created_idx on public.reward_redemptions (family_id, child_profile_id, created_at desc);
create index ledger_family_child_created_idx on public.point_ledger (family_id, child_profile_id, created_at desc);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['profiles', 'families', 'child_profiles', 'task_templates', 'tasks', 'rewards', 'wishlist_items'] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function private.touch_updated_at()', table_name, table_name);
  end loop;
end;
$$;

-- These helpers are security definer only because RLS membership checks must avoid
-- recursive reads of family_members. They are private, have a fixed search_path,
-- and explicitly bind authorization to auth.uid().
create or replace function private.is_family_member(target_family_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and exists (select 1 from public.family_members m where m.family_id = target_family_id and m.profile_id = (select auth.uid()));
$$;

create or replace function private.is_family_parent(target_family_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and exists (select 1 from public.family_members m where m.family_id = target_family_id and m.profile_id = (select auth.uid()) and m.role = 'parent');
$$;

create or replace function private.is_child_owner(target_family_id uuid, target_child_profile_id uuid)
returns boolean language sql stable security definer
set search_path = pg_catalog, public
as $$
  select (select auth.uid()) is not null
    and exists (select 1 from public.child_profiles c where c.family_id = target_family_id and c.id = target_child_profile_id and c.profile_id = (select auth.uid()));
$$;

create or replace function private.enforce_task_submission()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if not private.is_family_parent(old.family_id)
     and private.is_child_owner(old.family_id, old.child_profile_id) then
    if old.family_id <> new.family_id or old.child_profile_id <> new.child_profile_id
       or old.name <> new.name or old.points <> new.points or old.icon <> new.icon
       or old.duration_minutes is distinct from new.duration_minutes
       or old.is_daily <> new.is_daily or old.due_on is distinct from new.due_on
       or old.template_id is distinct from new.template_id
       or old.status <> 'todo' or new.status <> 'pending' or new.completed_at is null then
      raise exception 'children may only submit their own todo task' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.enforce_child_profile_membership()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.family_members m
    where m.family_id = new.family_id and m.profile_id = new.profile_id and m.role = 'child'
  ) then
    raise exception 'child profile must reference a child family member' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger child_profiles_membership_guard
  before insert or update on public.child_profiles
  for each row execute function private.enforce_child_profile_membership();

create or replace function private.enforce_member_role_change()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if old.role = 'child' and new.role <> 'child'
     and exists (select 1 from public.child_profiles c where c.family_id = old.family_id and c.profile_id = old.profile_id) then
    raise exception 'a child with a child profile cannot change role' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger family_members_role_guard
  before update on public.family_members
  for each row execute function private.enforce_member_role_change();

create or replace function private.enforce_redemption_update()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if old.family_id <> new.family_id or old.child_profile_id <> new.child_profile_id
     or old.reward_id <> new.reward_id or old.reward_name <> new.reward_name
     or old.reward_icon <> new.reward_icon or old.points_cost <> new.points_cost
     or old.created_at <> new.created_at then
    raise exception 'redemption accounting fields are immutable' using errcode = '42501';
  end if;
  if old.status <> 'pending' and old.status <> new.status then
    raise exception 'redemption status cannot change after resolution' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger reward_redemptions_update_guard
  before update on public.reward_redemptions
  for each row execute function private.enforce_redemption_update();

create trigger tasks_submission_guard
  before update on public.tasks
  for each row execute function private.enforce_task_submission();

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.child_profiles enable row level security;
alter table public.task_templates enable row level security;
alter table public.tasks enable row level security;
alter table public.rewards enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.point_ledger enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (
    (select auth.uid()) = id
    or exists (
      select 1 from public.family_members m
      where m.profile_id = profiles.id and private.is_family_member(m.family_id)
    )
  );
create policy profiles_insert on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy families_select on public.families for select to authenticated
  using (private.is_family_member(id));
create policy families_insert on public.families for insert to authenticated
  with check ((select auth.uid()) = created_by);
create policy families_update on public.families for update to authenticated
  using (private.is_family_parent(id)) with check (private.is_family_parent(id));
create policy families_delete on public.families for delete to authenticated
  using (private.is_family_parent(id) and created_by = (select auth.uid()));

create policy family_members_select on public.family_members for select to authenticated
  using (private.is_family_member(family_id));
create policy family_members_insert on public.family_members for insert to authenticated
  with check (private.is_family_parent(family_id) or (profile_id = (select auth.uid()) and role = 'parent' and exists (select 1 from public.families f where f.id = family_id and f.created_by = (select auth.uid()))));
create policy family_members_update on public.family_members for update to authenticated
  using (private.is_family_parent(family_id))
  with check (private.is_family_parent(family_id));
create policy family_members_delete on public.family_members for delete to authenticated
  using (private.is_family_parent(family_id));

create policy child_profiles_select on public.child_profiles for select to authenticated
  using (private.is_family_member(family_id));
create policy child_profiles_insert on public.child_profiles for insert to authenticated
  with check (private.is_family_parent(family_id) and exists (select 1 from public.family_members m where m.family_id = family_id and m.profile_id = child_profiles.profile_id and m.role = 'child'));
create policy child_profiles_update on public.child_profiles for update to authenticated
  using (private.is_family_parent(family_id)) with check (private.is_family_parent(family_id));
create policy child_profiles_delete on public.child_profiles for delete to authenticated
  using (private.is_family_parent(family_id));

create policy task_templates_select on public.task_templates for select to authenticated using (private.is_family_member(family_id));
create policy task_templates_insert on public.task_templates for insert to authenticated with check (private.is_family_parent(family_id));
create policy task_templates_update on public.task_templates for update to authenticated using (private.is_family_parent(family_id)) with check (private.is_family_parent(family_id));
create policy task_templates_delete on public.task_templates for delete to authenticated using (private.is_family_parent(family_id));

create policy tasks_select on public.tasks for select to authenticated using (private.is_family_member(family_id));
create policy tasks_insert on public.tasks for insert to authenticated with check (private.is_family_parent(family_id));
create policy tasks_update_parent on public.tasks for update to authenticated using (private.is_family_parent(family_id)) with check (private.is_family_parent(family_id));
create policy tasks_update_child on public.tasks for update to authenticated using (private.is_child_owner(family_id, child_profile_id) and status = 'todo') with check (private.is_child_owner(family_id, child_profile_id) and status = 'pending' and completed_at is not null);
create policy tasks_delete on public.tasks for delete to authenticated using (private.is_family_parent(family_id));

create policy rewards_select on public.rewards for select to authenticated using (private.is_family_member(family_id));
create policy rewards_insert on public.rewards for insert to authenticated with check (private.is_family_parent(family_id));
create policy rewards_update on public.rewards for update to authenticated using (private.is_family_parent(family_id)) with check (private.is_family_parent(family_id));
create policy rewards_delete on public.rewards for delete to authenticated using (private.is_family_parent(family_id));

create policy wishlist_select on public.wishlist_items for select to authenticated using (private.is_family_member(family_id));
create policy wishlist_insert on public.wishlist_items for insert to authenticated with check (private.is_child_owner(family_id, child_profile_id));
create policy wishlist_update on public.wishlist_items for update to authenticated using (private.is_child_owner(family_id, child_profile_id)) with check (private.is_child_owner(family_id, child_profile_id));
create policy wishlist_delete on public.wishlist_items for delete to authenticated using (private.is_child_owner(family_id, child_profile_id) or private.is_family_parent(family_id));

create policy redemptions_select on public.reward_redemptions for select to authenticated using (private.is_child_owner(family_id, child_profile_id) or private.is_family_parent(family_id));
create policy redemptions_update_parent on public.reward_redemptions for update to authenticated using (private.is_family_parent(family_id)) with check (private.is_family_parent(family_id));

create policy ledger_select on public.point_ledger for select to authenticated using (private.is_child_owner(family_id, child_profile_id) or private.is_family_parent(family_id));

create or replace function public.approve_task_completion(target_task_id uuid)
returns public.tasks
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  task_row public.tasks;
  child_row public.child_profiles;
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into task_row from public.tasks where id = target_task_id for update;
  if not found or not private.is_family_parent(task_row.family_id) then raise exception 'task not found or not authorized' using errcode = '42501'; end if;
  if task_row.status <> 'pending' then raise exception 'task is not pending'; end if;
  select * into child_row from public.child_profiles where id = task_row.child_profile_id for update;
  if exists (select 1 from public.point_ledger where task_id = task_row.id) then raise exception 'task already approved'; end if;
  insert into public.point_ledger (family_id, child_profile_id, task_id, entry_type, points_delta, note)
    values (task_row.family_id, task_row.child_profile_id, task_row.id, 'task_approved', task_row.points, 'task approved');
  update public.child_profiles set points_balance = points_balance + task_row.points where id = child_row.id returning * into child_row;
  update public.tasks set status = 'completed' where id = task_row.id returning * into task_row;
  return task_row;
end;
$$;

create or replace function public.redeem_reward(target_reward_id uuid)
returns public.reward_redemptions
language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare
  reward_row public.rewards;
  child_row public.child_profiles;
  redemption_row public.reward_redemptions;
begin
  if (select auth.uid()) is null then raise exception 'authentication required' using errcode = '42501'; end if;
  select * into reward_row from public.rewards where id = target_reward_id for update;
  if not found or not (private.is_child_owner(reward_row.family_id, reward_row.child_profile_id) or private.is_family_parent(reward_row.family_id)) then raise exception 'reward not found or not authorized' using errcode = '42501'; end if;
  select * into child_row from public.child_profiles where id = reward_row.child_profile_id for update;
  if child_row.points_balance < reward_row.points then raise exception 'insufficient points' using errcode = '22003'; end if;
  update public.child_profiles set points_balance = points_balance - reward_row.points where id = child_row.id;
  insert into public.reward_redemptions (family_id, child_profile_id, reward_id, reward_name, reward_icon, points_cost)
    values (reward_row.family_id, reward_row.child_profile_id, reward_row.id, reward_row.name, reward_row.icon, reward_row.points)
    returning * into redemption_row;
  insert into public.point_ledger (family_id, child_profile_id, redemption_id, entry_type, points_delta, note)
    values (reward_row.family_id, reward_row.child_profile_id, redemption_row.id, 'reward_redemption', -reward_row.points, 'reward redeemed');
  return redemption_row;
end;
$$;

revoke all on function public.approve_task_completion(uuid) from public, anon;
grant execute on function public.approve_task_completion(uuid) to authenticated;
revoke all on function public.redeem_reward(uuid) from public, anon;
grant execute on function public.redeem_reward(uuid) to authenticated;
revoke all on all functions in schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.is_family_member(uuid), private.is_family_parent(uuid), private.is_child_owner(uuid, uuid) to authenticated;

revoke all on all tables in schema public from public, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on table public.point_ledger from authenticated;
grant select on table public.point_ledger to authenticated;
revoke all on table public.reward_redemptions from authenticated;
grant select, update on table public.reward_redemptions to authenticated;
;
