-- HabitHero game economy: catalog, wallets, inventory, loadouts, and world state.
-- All mutations are intentionally added in the following RPC migration; these
-- tables expose read-only views to authenticated clients.

create table public.game_catalog_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('character', 'pet', 'decoration')),
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  scroll_price integer not null check (scroll_price >= 0),
  asset_key text not null check (char_length(trim(asset_key)) between 1 and 120),
  thumbnail_url text,
  is_active boolean not null default true,
  is_starter boolean not null default false,
  is_stackable boolean not null default false,
  collision_radius numeric(6,3) not null default 0.35 check (collision_radius > 0 and collision_radius <= 5),
  min_scale numeric(5,3) not null default 0.75 check (min_scale between 0.25 and 3),
  max_scale numeric(5,3) not null default 1.25 check (max_scale between 0.25 and 3),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (item_type, asset_key),
  check (max_scale >= min_scale),
  check ((is_starter and item_type = 'character' and scroll_price = 0) or (not is_starter and scroll_price >= 1))
);

create table public.family_game_item_prices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  catalog_item_id uuid not null references public.game_catalog_items(id) on delete restrict,
  scroll_price integer not null check (scroll_price >= 1),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (family_id, catalog_item_id)
);

create table public.child_game_wallets (
  child_profile_id uuid primary key,
  family_id uuid not null,
  scroll_balance bigint not null default 0 check (scroll_balance >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id) on delete cascade
);

create table public.game_item_purchases (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_profile_id uuid not null,
  catalog_item_id uuid not null references public.game_catalog_items(id) on delete restrict,
  idempotency_key uuid not null,
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price >= 1),
  total_price bigint not null check (total_price > 0),
  catalog_name_snapshot text not null,
  catalog_type_snapshot text not null check (catalog_type_snapshot in ('character', 'pet', 'decoration')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (family_id, id),
  unique (child_profile_id, idempotency_key),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id) on delete cascade,
  check (total_price = unit_price * quantity)
);

create table public.game_currency_ledger (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_profile_id uuid not null,
  currency text not null default 'quest_scroll' check (currency = 'quest_scroll'),
  entry_type text not null check (entry_type in ('task_approved', 'task_approval_reversal', 'purchase', 'refund', 'admin_adjustment', 'starter_grant')),
  amount_delta bigint not null check (amount_delta <> 0),
  source_task_id uuid,
  source_purchase_id uuid,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id) on delete cascade,
  foreign key (family_id, source_task_id)
    references public.tasks (family_id, id) on delete restrict,
  foreign key (source_purchase_id)
    references public.game_item_purchases(id) on delete restrict,
  check (
    (entry_type = 'task_approved' and amount_delta > 0 and source_task_id is not null and source_purchase_id is null)
    or (entry_type = 'task_approval_reversal' and amount_delta < 0 and source_task_id is not null and source_purchase_id is null)
    or (entry_type = 'purchase' and amount_delta < 0 and source_task_id is null and source_purchase_id is not null)
    or (entry_type = 'refund' and amount_delta > 0 and source_task_id is null and source_purchase_id is not null)
    or (entry_type = 'starter_grant' and amount_delta > 0 and source_task_id is null and source_purchase_id is null)
    or (entry_type = 'admin_adjustment' and source_task_id is null and source_purchase_id is null)
  )
);

create table public.child_inventory_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_profile_id uuid not null,
  catalog_item_id uuid not null references public.game_catalog_items(id) on delete restrict,
  quantity bigint not null default 1 check (quantity > 0),
  acquired_via text not null check (acquired_via in ('starter', 'purchase', 'grant')),
  acquired_at timestamptz not null default timezone('utc', now()),
  unique (family_id, id),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id) on delete cascade
);

create unique index child_inventory_non_stackable_unique
  on public.child_inventory_items (child_profile_id, catalog_item_id)
  where quantity = 1;

create table public.child_game_loadouts (
  child_profile_id uuid primary key,
  family_id uuid not null,
  equipped_character_inventory_id uuid,
  following_pet_inventory_id uuid,
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id) on delete cascade
);

create table public.child_world_states (
  child_profile_id uuid primary key,
  family_id uuid not null,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id) on delete cascade
);

create table public.child_world_entities (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_profile_id uuid not null,
  inventory_item_id uuid not null references public.child_inventory_items(id) on delete cascade,
  world_layout_version integer not null default 1 check (world_layout_version >= 1),
  position_x numeric(8,3) not null check (position_x between -5 and 5),
  position_y numeric(8,3) not null check (position_y between -2 and 5),
  position_z numeric(8,3) not null check (position_z between -5 and 5),
  rotation_x numeric(8,4) not null default 0 check (rotation_x between -6.284 and 6.284),
  rotation_y numeric(8,4) not null default 0 check (rotation_y between -6.284 and 6.284),
  rotation_z numeric(8,4) not null default 0 check (rotation_z between -6.284 and 6.284),
  scale numeric(5,3) not null default 1 check (scale between 0.25 and 3),
  behavior_mode text not null default 'static' check (behavior_mode in ('static', 'idle', 'wander')),
  roaming_slot smallint check (roaming_slot is null or roaming_slot between 1 and 3),
  is_active boolean not null default true,
  entity_kind text not null default 'decoration' check (entity_kind in ('pet', 'decoration')),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (family_id, id),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id) on delete cascade,
  check ((behavior_mode = 'wander' and roaming_slot between 1 and 3) or (behavior_mode <> 'wander' and roaming_slot is null))
);

create unique index child_world_wandering_pet_slot_unique
  on public.child_world_entities (child_profile_id, roaming_slot)
  where is_active and entity_kind = 'pet' and behavior_mode = 'wander';

create index child_world_entities_active_kind_idx
  on public.child_world_entities (child_profile_id, is_active, entity_kind);
create index child_inventory_child_catalog_idx
  on public.child_inventory_items (child_profile_id, catalog_item_id);
create index game_currency_ledger_child_created_idx
  on public.game_currency_ledger (child_profile_id, created_at desc);

create table public.task_approval_corrections (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_profile_id uuid not null,
  task_id uuid not null,
  corrected_by uuid not null references auth.users(id) on delete restrict,
  points_reversed integer not null default 0 check (points_reversed >= 0),
  scroll_reversed bigint not null default 0 check (scroll_reversed >= 0),
  reward_retained_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (task_id),
  foreign key (family_id, child_profile_id)
    references public.child_profiles (family_id, id) on delete cascade,
  foreign key (family_id, task_id)
    references public.tasks (family_id, id) on delete restrict,
  check (points_reversed > 0 or scroll_reversed > 0 or reward_retained_reason is not null)
);

create unique index game_currency_task_grant_unique
  on public.game_currency_ledger (source_task_id)
  where entry_type = 'task_approved' and source_task_id is not null;

-- The legacy point ledger used an unconditional task_id unique constraint and
-- multiple inline CHECK constraints. Reversals share the task id, so preserve
-- the original grant as the only positive task approval and link negative
-- entries to that original row. Discover constraints by definition as well as
-- by their historical names because PostgreSQL generated names can differ.
alter table public.point_ledger
  drop constraint if exists point_ledger_task_id_key,
  drop constraint if exists point_ledger_entry_type_check,
  add column if not exists reversal_of_ledger_id uuid references public.point_ledger(id) on delete restrict;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
     where nsp.nspname = 'public'
       and rel.relname = 'point_ledger'
       and con.contype = 'c'
  loop
    execute format('alter table public.point_ledger drop constraint %I', constraint_name);
  end loop;

  for constraint_name in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
     where nsp.nspname = 'public'
       and rel.relname = 'point_ledger'
       and con.contype = 'u'
       and pg_get_constraintdef(con.oid) ilike '%(task_id)%'
  loop
    execute format('alter table public.point_ledger drop constraint %I', constraint_name);
  end loop;
end;
$$;

create unique index if not exists point_ledger_task_approval_unique
  on public.point_ledger (task_id)
  where entry_type = 'task_approved' and task_id is not null;

alter table public.point_ledger
  add constraint point_ledger_points_delta_nonzero_check check (points_delta <> 0),
  add constraint point_ledger_game_entry_check check (
    (entry_type = 'task_approved' and task_id is not null and redemption_id is null and points_delta > 0 and reversal_of_ledger_id is null)
    or (entry_type = 'task_approval_reversal' and task_id is not null and redemption_id is null and points_delta < 0 and reversal_of_ledger_id is not null)
    or (entry_type = 'reward_redemption' and task_id is null and redemption_id is not null and points_delta < 0 and reversal_of_ledger_id is null)
    or (entry_type = 'manual_adjustment' and task_id is null and redemption_id is null and reversal_of_ledger_id is null)
  );

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'game_catalog_items', 'family_game_item_prices', 'child_game_wallets',
    'game_item_purchases', 'child_game_loadouts', 'child_world_states',
    'child_world_entities'
  ] loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function private.touch_updated_at()', table_name, table_name);
  end loop;
end;
$$;

alter table public.game_catalog_items enable row level security;
alter table public.family_game_item_prices enable row level security;
alter table public.child_game_wallets enable row level security;
alter table public.game_item_purchases enable row level security;
alter table public.game_currency_ledger enable row level security;
alter table public.child_inventory_items enable row level security;
alter table public.child_game_loadouts enable row level security;
alter table public.child_world_states enable row level security;
alter table public.child_world_entities enable row level security;
alter table public.task_approval_corrections enable row level security;

create policy game_catalog_select on public.game_catalog_items for select to authenticated
  using (
    is_active
    or exists (
      select 1 from public.family_members member
       where member.profile_id = (select auth.uid()) and member.role = 'parent'
    )
    or exists (
      select 1 from public.child_inventory_items inventory
       join public.child_profiles child on child.id = inventory.child_profile_id
      where inventory.catalog_item_id = game_catalog_items.id
        and child.profile_id = (select auth.uid())
    )
  );

create policy family_game_prices_select on public.family_game_item_prices for select to authenticated
  using (private.is_family_member(family_id));
create policy family_game_prices_parent_write on public.family_game_item_prices for all to authenticated
  using (private.is_family_parent(family_id)) with check (private.is_family_parent(family_id));

create policy game_wallet_select on public.child_game_wallets for select to authenticated
  using (private.is_child_owner(family_id, child_profile_id) or private.is_family_parent(family_id));
create policy game_purchase_select on public.game_item_purchases for select to authenticated
  using (private.is_child_owner(family_id, child_profile_id) or private.is_family_parent(family_id));
create policy game_currency_ledger_select on public.game_currency_ledger for select to authenticated
  using (private.is_child_owner(family_id, child_profile_id) or private.is_family_parent(family_id));
create policy child_inventory_select on public.child_inventory_items for select to authenticated
  using (private.is_child_owner(family_id, child_profile_id) or private.is_family_parent(family_id));
create policy child_loadout_select on public.child_game_loadouts for select to authenticated
  using (private.is_child_owner(family_id, child_profile_id) or private.is_family_parent(family_id));
create policy child_world_state_select on public.child_world_states for select to authenticated
  using (private.is_child_owner(family_id, child_profile_id) or private.is_family_parent(family_id));
create policy child_world_entity_select on public.child_world_entities for select to authenticated
  using (private.is_child_owner(family_id, child_profile_id) or private.is_family_parent(family_id));
create policy task_approval_corrections_select on public.task_approval_corrections for select to authenticated
  using (private.is_child_owner(family_id, child_profile_id) or private.is_family_parent(family_id));

revoke all on table public.game_catalog_items, public.family_game_item_prices,
  public.child_game_wallets, public.game_item_purchases, public.game_currency_ledger,
  public.child_inventory_items, public.child_game_loadouts, public.child_world_states,
  public.child_world_entities, public.task_approval_corrections from public, anon, authenticated;
grant select on table public.game_catalog_items, public.family_game_item_prices,
  public.child_game_wallets, public.game_item_purchases, public.game_currency_ledger,
  public.child_inventory_items, public.child_game_loadouts, public.child_world_states,
  public.child_world_entities, public.task_approval_corrections to authenticated;

create or replace function private.initialize_child_game_data(target_family_id uuid, target_child_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  starter_item public.game_catalog_items;
  starter_inventory_id uuid;
begin
  insert into public.child_game_wallets (family_id, child_profile_id)
  values (target_family_id, target_child_profile_id)
  on conflict (child_profile_id) do nothing;
  insert into public.child_world_states (family_id, child_profile_id)
  values (target_family_id, target_child_profile_id)
  on conflict (child_profile_id) do nothing;
  select * into starter_item from public.game_catalog_items
   where item_type = 'character' and asset_key = 'character.anime-maiden' and is_starter
   limit 1;
  if found then
    insert into public.child_inventory_items (
      family_id, child_profile_id, catalog_item_id, quantity, acquired_via
    ) values (
      target_family_id, target_child_profile_id, starter_item.id, 1, 'starter'
    ) on conflict do nothing returning id into starter_inventory_id;
    if starter_inventory_id is null then
      select id into starter_inventory_id from public.child_inventory_items
       where child_profile_id = target_child_profile_id and catalog_item_id = starter_item.id limit 1;
    end if;
    insert into public.child_game_loadouts (
      family_id, child_profile_id, equipped_character_inventory_id
    ) values (
      target_family_id, target_child_profile_id, starter_inventory_id
    ) on conflict (child_profile_id) do update
      set equipped_character_inventory_id = coalesce(public.child_game_loadouts.equipped_character_inventory_id, excluded.equipped_character_inventory_id);
  end if;
end;
$$;

revoke all on function private.initialize_child_game_data(uuid, uuid) from public, anon, authenticated;
