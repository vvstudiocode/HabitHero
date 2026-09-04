-- Scene NPC shops are additive. Existing catalog, inventory, loadout, world,
-- and purchase rows remain addressable for legacy accounts.
begin;

create table public.game_world_scenes (
  id text primary key,
  name text not null check (char_length(trim(name)) between 1 and 80),
  sort_order integer not null unique check (sort_order > 0),
  required_completed_count integer not null default 0 check (required_completed_count >= 0),
  required_general_count integer not null default 0 check (required_general_count >= 0),
  unlock_rule_version integer not null default 1 check (unlock_rule_version > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (required_general_count <= required_completed_count)
);

create table public.game_world_npcs (
  id text primary key,
  scene_id text not null references public.game_world_scenes(id) on delete restrict,
  npc_type text not null check (npc_type in ('character_vendor', 'roaming_pet')),
  name text not null check (char_length(trim(name)) between 1 and 80),
  asset_key text not null check (char_length(trim(asset_key)) between 1 and 120),
  catalog_item_id uuid references public.game_catalog_items(id) on delete restrict,
  position_x numeric(8,3) not null default 0,
  position_y numeric(8,3) not null default 0,
  position_z numeric(8,3) not null default 0,
  behavior_mode text not null check (behavior_mode in ('dance_anchor', 'roaming')),
  animation_name text not null check (char_length(trim(animation_name)) between 1 and 80),
  roam_bounds jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((npc_type = 'roaming_pet' and behavior_mode = 'roaming' and catalog_item_id is not null and roam_bounds is not null)
    or (npc_type = 'character_vendor' and behavior_mode = 'dance_anchor'))
);

create table public.game_world_npc_offerings (
  npc_id text not null references public.game_world_npcs(id) on delete restrict,
  catalog_item_id uuid not null references public.game_catalog_items(id) on delete restrict,
  sort_order integer not null check (sort_order > 0),
  dialogue_version integer not null default 1 check (dialogue_version > 0),
  is_primary_source boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (npc_id, catalog_item_id)
);

create unique index game_world_offering_primary_source_unique
  on public.game_world_npc_offerings(catalog_item_id)
  where is_active and is_primary_source;

create table public.child_world_scene_unlocks (
  family_id uuid not null,
  child_profile_id uuid not null,
  scene_id text not null references public.game_world_scenes(id) on delete restrict,
  unlock_rule_version integer not null check (unlock_rule_version > 0),
  unlocked_at timestamptz not null default timezone('utc', now()),
  primary key (child_profile_id, scene_id),
  foreign key (family_id, child_profile_id)
    references public.child_profiles(family_id, id) on delete cascade
);

create table public.child_world_npc_dialogue_progress (
  family_id uuid not null,
  child_profile_id uuid not null,
  npc_id text not null references public.game_world_npcs(id) on delete restrict,
  dialogue_version integer not null default 1 check (dialogue_version > 0),
  first_talked_at timestamptz not null default timezone('utc', now()),
  last_talked_at timestamptz not null default timezone('utc', now()),
  primary key (child_profile_id, npc_id),
  foreign key (family_id, child_profile_id)
    references public.child_profiles(family_id, id) on delete cascade
);

alter table public.game_catalog_items
  add column if not exists is_child_creation_selectable boolean not null default false,
  add column if not exists is_newly_obtainable boolean not null default true;

-- Older invite/account RPCs insert a child without an explicit character. Give
-- that still-supported path the first allowed character while the trigger
-- below rejects any explicit unsupported selection.
alter table public.child_profiles
  alter column character_id set default 'character.arthur';

alter table public.game_item_purchases
  add column if not exists source_scene_id text
    references public.game_world_scenes(id) on delete restrict,
  add column if not exists source_npc_id text
    references public.game_world_npcs(id) on delete restrict,
  add column if not exists source_dialogue_version integer
    check (source_dialogue_version is null or source_dialogue_version > 0),
  add constraint game_item_purchases_source_shape_check
    check ((source_scene_id is null) = (source_npc_id is null)
      and (source_npc_id is null or source_dialogue_version is not null));

alter table public.child_inventory_items
  add column if not exists source_scene_id text
    references public.game_world_scenes(id) on delete restrict,
  add column if not exists source_npc_id text
    references public.game_world_npcs(id) on delete restrict,
  add column if not exists source_dialogue_version integer
    check (source_dialogue_version is null or source_dialogue_version > 0),
  add constraint child_inventory_source_shape_check
    check ((source_scene_id is null) = (source_npc_id is null)
      and (source_npc_id is null or source_dialogue_version is not null));

create index game_world_npcs_scene_idx
  on public.game_world_npcs(scene_id, is_active);
create index game_world_npc_offerings_catalog_idx
  on public.game_world_npc_offerings(catalog_item_id, is_active);
create index child_world_scene_unlocks_child_idx
  on public.child_world_scene_unlocks(child_profile_id, scene_id);
create index child_world_npc_dialogue_child_idx
  on public.child_world_npc_dialogue_progress(child_profile_id, npc_id);

create trigger game_world_scenes_updated_at
before update on public.game_world_scenes
for each row execute function private.touch_updated_at();
create trigger game_world_npcs_updated_at
before update on public.game_world_npcs
for each row execute function private.touch_updated_at();
create trigger game_world_npc_offerings_updated_at
before update on public.game_world_npc_offerings
for each row execute function private.touch_updated_at();

create or replace function private.enforce_world_source_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.source_npc_id is not null and not exists (
    select 1 from public.game_world_npcs npc
     where npc.id = new.source_npc_id
       and npc.scene_id = new.source_scene_id
  ) then
    raise exception 'source NPC does not belong to source scene' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger game_item_purchases_source_guard
before insert or update on public.game_item_purchases
for each row execute function private.enforce_world_source_snapshot();
create trigger child_inventory_source_guard
before insert or update on public.child_inventory_items
for each row execute function private.enforce_world_source_snapshot();

alter table public.game_world_scenes enable row level security;
alter table public.game_world_npcs enable row level security;
alter table public.game_world_npc_offerings enable row level security;
alter table public.child_world_scene_unlocks enable row level security;
alter table public.child_world_npc_dialogue_progress enable row level security;

create policy game_world_scenes_select
on public.game_world_scenes for select to authenticated
using (is_active);

create policy game_world_npcs_select
on public.game_world_npcs for select to authenticated
using (
  is_active and exists (
    select 1 from public.game_world_scenes scene
     where scene.id = game_world_npcs.scene_id and scene.is_active
  )
);

create policy game_world_npc_offerings_select
on public.game_world_npc_offerings for select to authenticated
using (
  is_active and exists (
    select 1
      from public.game_world_npcs npc
      join public.game_world_scenes scene on scene.id = npc.scene_id
     where npc.id = game_world_npc_offerings.npc_id
       and npc.is_active and scene.is_active
  )
);

create policy child_world_scene_unlocks_select
on public.child_world_scene_unlocks for select to authenticated
using (private.is_family_parent(family_id) or private.is_child_owner(family_id, child_profile_id));

create policy child_world_npc_dialogue_progress_select
on public.child_world_npc_dialogue_progress for select to authenticated
using (private.is_family_parent(family_id) or private.is_child_owner(family_id, child_profile_id));

revoke all on table public.game_world_scenes, public.game_world_npcs,
  public.game_world_npc_offerings, public.child_world_scene_unlocks,
  public.child_world_npc_dialogue_progress
  from public, anon, authenticated;
grant select on table public.game_world_scenes, public.game_world_npcs,
  public.game_world_npc_offerings, public.child_world_scene_unlocks,
  public.child_world_npc_dialogue_progress to authenticated;

insert into public.game_world_scenes
  (id, name, sort_order, required_completed_count, required_general_count, unlock_rule_version)
values
  ('sunrise-village', '晨光村', 1, 0, 0, 1),
  ('forest-valley', '森語谷', 2, 5, 0, 1),
  ('cloud-workshop', '雲工房', 3, 12, 2, 1),
  ('tideglow-archipelago', '潮光群島', 4, 20, 5, 1),
  ('star-sand-wasteland', '星砂荒原', 5, 30, 10, 1)
on conflict (id) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  required_completed_count = excluded.required_completed_count,
  required_general_count = excluded.required_general_count,
  unlock_rule_version = excluded.unlock_rule_version,
  is_active = true,
  updated_at = timezone('utc', now());

update public.game_catalog_items
   set is_child_creation_selectable = asset_key in (
     'character.arthur', 'character.elina', 'character.sia', 'character.elio'
   )
 where item_type = 'character';

-- These keys include the legacy starlight-sprout alias for Forest Guardian.
-- Keep every row active so existing inventory and world references continue to
-- resolve; only new acquisition is disabled.
update public.game_catalog_items
   set is_newly_obtainable = false
 where item_type = 'pet'
   and asset_key in (
     'pet.forest-guardian', 'pet.starlight-sprout', 'pet.chrono-rabbit',
     'pet.silf-owl', 'pet.yaoguang-deer', 'pet.murphy-bear',
     'pet.magellan-rabbit', 'pet.buleifu-tiger', 'pet.belilos-fox',
     'pet.baruku-mushroom', 'pet.star-diver'
   );

insert into public.game_world_npcs
  (id, scene_id, npc_type, name, asset_key, catalog_item_id,
   position_x, position_y, position_z, behavior_mode, animation_name)
select seed.id, seed.scene_id, 'character_vendor', seed.name, seed.asset_key,
       item.id, seed.position_x, 0, seed.position_z, 'dance_anchor', 'Dance'
  from (values
    ('npc.gilt', 'sunrise-village', '吉爾特', 'character.gilt', 0::numeric, -2::numeric),
    ('npc.moss', 'forest-valley', '莫斯', 'character.moss', -2::numeric, -1::numeric),
    ('npc.lunalia', 'forest-valley', '露娜莉亞', 'character.lunalia', 2::numeric, -1::numeric),
    ('npc.noah', 'cloud-workshop', '諾亞', 'character.noah', 0::numeric, -2::numeric),
    ('npc.collette', 'tideglow-archipelago', '柯蕾特', 'character.collette', 0::numeric, -2::numeric),
    ('npc.violette', 'star-sand-wasteland', '薇歐莉特', 'character.violette', 0::numeric, -2::numeric)
  ) as seed(id, scene_id, name, asset_key, position_x, position_z)
  join public.game_catalog_items item
    on item.item_type = 'character' and item.asset_key = seed.asset_key
on conflict (id) do update set
  scene_id = excluded.scene_id,
  npc_type = excluded.npc_type,
  name = excluded.name,
  asset_key = excluded.asset_key,
  catalog_item_id = excluded.catalog_item_id,
  position_x = excluded.position_x,
  position_y = excluded.position_y,
  position_z = excluded.position_z,
  behavior_mode = excluded.behavior_mode,
  animation_name = excluded.animation_name,
  is_active = true,
  updated_at = timezone('utc', now());

with roaming(npc_id, scene_id, asset_key, x, z) as (values
  ('npc.oum', 'sunrise-village', 'pet.oum', -3::numeric, 1::numeric),
  ('npc.arcadia', 'sunrise-village', 'pet.arcadia', 3::numeric, 1::numeric),
  ('npc.jasmine', 'forest-valley', 'pet.jasmine', -3::numeric, 1::numeric),
  ('npc.qifu-er', 'forest-valley', 'pet.qifu-er', 3::numeric, 1::numeric),
  ('npc.nibus', 'cloud-workshop', 'pet.nibus', -3::numeric, 1::numeric),
  ('npc.orian', 'cloud-workshop', 'pet.orian', 3::numeric, 1::numeric),
  ('npc.christo', 'tideglow-archipelago', 'pet.christo', 0::numeric, 1::numeric),
  ('npc.kaldo', 'star-sand-wasteland', 'pet.kaldo', -3::numeric, 1::numeric),
  ('npc.moko', 'star-sand-wasteland', 'pet.moko', 3::numeric, 1::numeric)
)
insert into public.game_world_npcs
  (id, scene_id, npc_type, name, asset_key, catalog_item_id,
   position_x, position_y, position_z, behavior_mode, animation_name, roam_bounds)
select roaming.npc_id, roaming.scene_id, 'roaming_pet', item.name, roaming.asset_key,
       item.id, roaming.x, 0, roaming.z, 'roaming', 'Idle',
       jsonb_build_object('minX', -6, 'maxX', 6, 'minZ', -4, 'maxZ', 4)
  from roaming
  join public.game_catalog_items item
    on item.item_type = 'pet' and item.asset_key = roaming.asset_key
on conflict (id) do update set
  scene_id = excluded.scene_id,
  npc_type = excluded.npc_type,
  name = excluded.name,
  asset_key = excluded.asset_key,
  catalog_item_id = excluded.catalog_item_id,
  position_x = excluded.position_x,
  position_y = excluded.position_y,
  position_z = excluded.position_z,
  behavior_mode = excluded.behavior_mode,
  animation_name = excluded.animation_name,
  roam_bounds = excluded.roam_bounds,
  is_active = true,
  updated_at = timezone('utc', now());

do $$
begin
  if (select count(*) from public.game_world_npcs where id in
    ('npc.gilt', 'npc.moss', 'npc.lunalia', 'npc.noah', 'npc.collette', 'npc.violette')) <> 6
     or (select count(*) from public.game_world_npcs where id in
    ('npc.oum', 'npc.arcadia', 'npc.jasmine', 'npc.qifu-er', 'npc.nibus', 'npc.orian', 'npc.christo', 'npc.kaldo', 'npc.moko')) <> 9 then
    raise exception 'scene NPC seed cardinality is invalid';
  end if;
end;
$$;

with offering(npc_id, asset_key, sort_order) as (values
  ('npc.gilt', 'pet.oum', 1), ('npc.gilt', 'pet.arcadia', 2),
  ('npc.gilt', 'decoration.bed', 3), ('npc.gilt', 'decoration.nightstand', 4),
  ('npc.gilt', 'decoration.sofa', 5), ('npc.gilt', 'decoration.pawprint-rug', 6),
  ('npc.moss', 'pet.jasmine', 1), ('npc.moss', 'pet.qifu-er', 2),
  ('npc.moss', 'decoration.stone-fire-pit', 3),
  ('npc.lunalia', 'decoration.fountain', 1),
  ('npc.lunalia', 'decoration.patchwork-rug', 2),
  ('npc.lunalia', 'decoration.wall', 3),
  ('npc.noah', 'pet.nibus', 1), ('npc.noah', 'pet.orian', 2),
  ('npc.noah', 'decoration.computer-desk', 3),
  ('npc.noah', 'decoration.study-desk', 4),
  ('npc.noah', 'decoration.study-chair', 5),
  ('npc.noah', 'decoration.gaming-chair', 6),
  ('npc.collette', 'pet.christo', 1),
  ('npc.collette', 'decoration.blue-rug', 2), ('npc.collette', 'decoration.lavender-pattern-rug', 3),
  ('npc.collette', 'decoration.floor-lamp', 4),
  ('npc.violette', 'pet.kaldo', 1), ('npc.violette', 'pet.moko', 2),
  ('npc.violette', 'decoration.bookcase', 3),
  ('npc.violette', 'decoration.curtain-wall', 4),
  ('npc.violette', 'decoration.royal-crest-rug', 5)
)
insert into public.game_world_npc_offerings
  (npc_id, catalog_item_id, sort_order, dialogue_version, is_primary_source)
select offering.npc_id, item.id, offering.sort_order, 1, true
  from offering
  join public.game_world_npcs npc on npc.id = offering.npc_id and npc.is_active
  join public.game_catalog_items item on item.asset_key = offering.asset_key
on conflict (npc_id, catalog_item_id) do update set
  sort_order = excluded.sort_order,
  dialogue_version = excluded.dialogue_version,
  is_primary_source = true,
  is_active = true,
  updated_at = timezone('utc', now());

insert into public.game_world_npc_offerings
  (npc_id, catalog_item_id, sort_order, dialogue_version, is_primary_source)
select npc.id, npc.catalog_item_id, 1, 1, false
  from public.game_world_npcs npc
 where npc.npc_type = 'roaming_pet'
   and npc.is_active
   and npc.catalog_item_id is not null
on conflict (npc_id, catalog_item_id) do update set
  sort_order = 1,
  dialogue_version = 1,
  is_primary_source = false,
  is_active = true,
  updated_at = timezone('utc', now());

do $$
begin
  if (select count(*) from public.game_world_npc_offerings where is_primary_source
      and npc_id in ('npc.gilt', 'npc.moss', 'npc.lunalia', 'npc.noah', 'npc.collette', 'npc.violette')) <> 27
     or (select count(*) from public.game_world_npc_offerings where not is_primary_source
      and npc_id in ('npc.oum', 'npc.arcadia', 'npc.jasmine', 'npc.qifu-er', 'npc.nibus', 'npc.orian', 'npc.christo', 'npc.kaldo', 'npc.moko')) <> 9 then
    raise exception 'scene NPC offering seed cardinality is invalid';
  end if;
end;
$$;

-- Existing children start in the canonical first scene. New children receive
-- the same row from the after-insert trigger below.
insert into public.child_world_scene_unlocks
  (family_id, child_profile_id, scene_id, unlock_rule_version)
select child.family_id, child.id, scene.id, scene.unlock_rule_version
  from public.child_profiles child
  join public.game_world_scenes scene on scene.id = 'sunrise-village'
on conflict (child_profile_id, scene_id) do nothing;

drop trigger if exists enforce_new_child_character on public.child_profiles;
create or replace function private.enforce_new_child_character()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.game_catalog_items item
     where item.item_type = 'character'
       and item.asset_key = new.character_id
       and item.is_active
       and item.is_child_creation_selectable
  ) then
    raise exception 'child character is not selectable' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger enforce_new_child_character
before insert on public.child_profiles
for each row execute function private.enforce_new_child_character();
revoke all on function private.enforce_new_child_character() from public, anon, authenticated;

drop trigger if exists initialize_world_scene_unlocks on public.child_profiles;
create or replace function private.initialize_world_scene_unlocks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.child_world_scene_unlocks
    (family_id, child_profile_id, scene_id, unlock_rule_version)
  select new.family_id, new.id, scene.id, scene.unlock_rule_version
    from public.game_world_scenes scene
   where scene.id = 'sunrise-village' and scene.is_active
  on conflict (child_profile_id, scene_id) do nothing;
  return new;
end;
$$;
create trigger initialize_world_scene_unlocks
after insert on public.child_profiles
for each row execute function private.initialize_world_scene_unlocks_after_insert();
revoke all on function private.initialize_world_scene_unlocks_after_insert() from public, anon, authenticated;

drop trigger if exists enforce_new_game_item_obtainability on public.child_inventory_items;
create or replace function private.enforce_new_game_item_obtainability()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.acquired_via in ('purchase', 'grant') and exists (
    select 1 from public.game_catalog_items item
     where item.id = new.catalog_item_id and not item.is_newly_obtainable
  ) then
    raise exception 'legacy item cannot be newly obtained' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger enforce_new_game_item_obtainability
before insert on public.child_inventory_items
for each row execute function private.enforce_new_game_item_obtainability();
revoke all on function private.enforce_new_game_item_obtainability() from public, anon, authenticated;

create or replace function public.unlock_world_scene_if_eligible(
  target_scene_id text,
  target_child_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  child_row public.child_profiles;
  scene_row public.game_world_scenes;
  unlock_row public.child_world_scene_unlocks;
  completed_count bigint;
  general_completed_count bigint;
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  select * into scene_row
    from public.game_world_scenes
   where id = target_scene_id and is_active
   for update;
  if not found then
    raise exception 'scene not found or inactive' using errcode = '22023';
  end if;

  select * into unlock_row
    from public.child_world_scene_unlocks
   where child_profile_id = child_row.id and scene_id = scene_row.id;
  if found then
    return jsonb_build_object(
      'scene_id', unlock_row.scene_id,
      'unlocked', true,
      'unlock_rule_version', unlock_row.unlock_rule_version,
      'unlocked_at', unlock_row.unlocked_at,
      'already_unlocked', true
    );
  end if;

  select count(*) into completed_count
    from public.tasks task
   where task.family_id = child_row.family_id
     and task.child_profile_id = child_row.id
     and task.status = 'completed';
  select count(*) into general_completed_count
    from public.tasks task
   where task.family_id = child_row.family_id
     and task.child_profile_id = child_row.id
     and task.status = 'completed'
     and task.adventure_type = 'general';

  if completed_count < scene_row.required_completed_count
     or general_completed_count < scene_row.required_general_count then
    return jsonb_build_object(
      'scene_id', scene_row.id,
      'unlocked', false,
      'completed_count', completed_count,
      'general_completed_count', general_completed_count,
      'required_completed_count', scene_row.required_completed_count,
      'required_general_count', scene_row.required_general_count,
      'already_unlocked', false
    );
  end if;

  insert into public.child_world_scene_unlocks
    (family_id, child_profile_id, scene_id, unlock_rule_version)
  values (child_row.family_id, child_row.id, scene_row.id, scene_row.unlock_rule_version)
  on conflict (child_profile_id, scene_id) do nothing;
  select * into unlock_row
    from public.child_world_scene_unlocks
   where child_profile_id = child_row.id and scene_id = scene_row.id;
  return jsonb_build_object(
    'scene_id', unlock_row.scene_id,
    'unlocked', true,
    'unlock_rule_version', unlock_row.unlock_rule_version,
    'unlocked_at', unlock_row.unlocked_at,
    'completed_count', completed_count,
    'general_completed_count', general_completed_count,
    'already_unlocked', false
  );
end;
$$;

create or replace function public.complete_world_npc_dialogue(
  target_npc_id text,
  target_child_profile_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  child_row public.child_profiles;
  npc_row public.game_world_npcs;
  dialogue_version integer;
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  select npc.* into npc_row
    from public.game_world_npcs npc
    join public.game_world_scenes scene on scene.id = npc.scene_id
    join public.child_world_scene_unlocks unlock_row
      on unlock_row.scene_id = scene.id and unlock_row.child_profile_id = child_row.id
   where npc.id = target_npc_id and npc.is_active and scene.is_active;
  if not found then
    raise exception 'NPC not found or scene is locked' using errcode = '42501';
  end if;

  select coalesce(max(offering.dialogue_version), 1) into dialogue_version
    from public.game_world_npc_offerings offering
   where offering.npc_id = npc_row.id and offering.is_active;
  insert into public.child_world_npc_dialogue_progress
    (family_id, child_profile_id, npc_id, dialogue_version)
  values (child_row.family_id, child_row.id, npc_row.id, dialogue_version)
  on conflict (child_profile_id, npc_id) do update set
    dialogue_version = greatest(
      public.child_world_npc_dialogue_progress.dialogue_version,
      excluded.dialogue_version
    ),
    last_talked_at = timezone('utc', now());

  return jsonb_build_object(
    'npc_id', npc_row.id,
    'scene_id', npc_row.scene_id,
    'dialogue_version', dialogue_version,
    'offerings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'catalog_item_id', offering.catalog_item_id,
        'asset_key', item.asset_key,
        'name', item.name,
        'item_type', item.item_type,
        'scroll_price', item.scroll_price,
        'sort_order', offering.sort_order,
        'source_scene_id', npc_row.scene_id,
        'source_npc_id', npc_row.id,
        'source_dialogue_version', offering.dialogue_version
      ) order by offering.sort_order, item.sort_order, item.id)
      from public.game_world_npc_offerings offering
      join public.game_catalog_items item on item.id = offering.catalog_item_id
       where offering.npc_id = npc_row.id
         and offering.is_active
         and item.is_active
         and item.is_newly_obtainable
    ), '[]'::jsonb)
  );
end;
$$;

-- Replace the four-argument purchase RPC with a five-argument version. The
-- final default keeps legacy global-shop callers compatible; scene offerings
-- require a validated NPC source.
drop function if exists public.purchase_game_item(uuid, integer, uuid, uuid, text);
drop function if exists public.purchase_game_item(uuid, integer, uuid, uuid);
create function public.purchase_game_item(
  target_catalog_item_id uuid,
  target_quantity integer,
  purchase_idempotency_key uuid,
  target_child_profile_id uuid default null,
  target_source_npc_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  child_row public.child_profiles;
  catalog_row public.game_catalog_items;
  wallet_row public.child_game_wallets;
  inventory_row public.child_inventory_items;
  purchase_row public.game_item_purchases;
  unit_price integer;
  total_price bigint;
  family_override integer;
  inventory_found boolean := false;
  repeatable_pet boolean := false;
  next_instance_number integer := 1;
  purchase_source_scene_id text;
  purchase_source_dialogue_version integer;
begin
  child_row := private.resolve_game_child(target_child_profile_id);
  if target_quantity is null or target_quantity <= 0 or purchase_idempotency_key is null then
    raise exception 'purchase details are invalid' using errcode = '22023';
  end if;

  insert into public.child_game_wallets (family_id, child_profile_id)
  values (child_row.family_id, child_row.id)
  on conflict (child_profile_id) do nothing;
  select * into wallet_row
    from public.child_game_wallets
   where child_profile_id = child_row.id
   for update;

  select * into purchase_row
   from public.game_item_purchases
   where child_profile_id = child_row.id
     and idempotency_key = purchase_idempotency_key;
  if found then
    if purchase_row.catalog_item_id <> target_catalog_item_id
       or purchase_row.quantity <> target_quantity
       or purchase_row.source_npc_id is distinct from target_source_npc_id then
      raise exception 'purchase idempotency key was reused for a different request' using errcode = '22023';
    end if;
    if purchase_row.inventory_item_id is not null then
      select * into inventory_row
        from public.child_inventory_items
       where id = purchase_row.inventory_item_id
         and child_profile_id = child_row.id;
    else
      -- Compatibility fallback for purchases created before inventory_item_id.
      select * into inventory_row
        from public.child_inventory_items
       where child_profile_id = child_row.id
         and catalog_item_id = purchase_row.catalog_item_id
       order by instance_number, acquired_at, id
       limit 1;
    end if;
    if not found then
      raise exception 'purchase inventory item is missing' using errcode = 'P0002';
    end if;
    return jsonb_build_object(
      'purchase_id', purchase_row.id,
      'wallet_balance', wallet_row.scroll_balance,
      'inventory_item_id', inventory_row.id,
      'quantity', inventory_row.quantity,
      'source_scene_id', coalesce(purchase_row.source_scene_id, inventory_row.source_scene_id),
      'source_npc_id', coalesce(purchase_row.source_npc_id, inventory_row.source_npc_id),
      'source_dialogue_version', coalesce(purchase_row.source_dialogue_version, inventory_row.source_dialogue_version),
      'idempotent_replay', true
    );
  end if;

  select * into catalog_row
    from public.game_catalog_items
   where id = target_catalog_item_id
   for update;
  if not found or not catalog_row.is_active or catalog_row.is_starter
     or not catalog_row.is_newly_obtainable then
    raise exception 'catalog item is not purchasable' using errcode = '22023';
  end if;
  repeatable_pet := catalog_row.item_type = 'pet';
  if not catalog_row.is_stackable and target_quantity <> 1 then
    raise exception 'this item cannot be purchased in a quantity' using errcode = '22023';
  end if;

  if target_source_npc_id is not null then
    select npc.scene_id, offering.dialogue_version
      into purchase_source_scene_id, purchase_source_dialogue_version
      from public.game_world_npcs npc
      join public.game_world_npc_offerings offering
        on offering.npc_id = npc.id
       and offering.catalog_item_id = catalog_row.id
       and offering.is_active
      join public.game_world_scenes scene
        on scene.id = npc.scene_id and scene.is_active
     where npc.id = target_source_npc_id and npc.is_active;
    if not found then
      raise exception 'NPC does not offer this item' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.child_world_scene_unlocks unlock_row
       where unlock_row.child_profile_id = child_row.id
         and unlock_row.scene_id = purchase_source_scene_id
    ) then
      raise exception 'scene is locked for this child' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.child_world_npc_dialogue_progress dialogue
       where dialogue.child_profile_id = child_row.id
         and dialogue.npc_id = target_source_npc_id
         and dialogue.dialogue_version >= purchase_source_dialogue_version
    ) then
      raise exception 'NPC dialogue is incomplete' using errcode = '42501';
    end if;
  elsif target_source_npc_id is null and exists (
    select 1
      from public.game_world_npcs npc
      join public.game_world_npc_offerings offering
        on offering.npc_id = npc.id
       and offering.catalog_item_id = catalog_row.id
       and offering.is_active
      join public.game_world_scenes scene
        on scene.id = npc.scene_id and scene.is_active
     where npc.is_active
  ) then
    raise exception 'source NPC is required for this item' using errcode = '42501';
  end if;

  select scroll_price into family_override
    from public.family_game_item_prices
   where family_id = child_row.family_id
     and catalog_item_id = catalog_row.id;
  unit_price := coalesce(family_override, catalog_row.scroll_price);
  if unit_price < 1 then
    raise exception 'catalog price is invalid' using errcode = '22023';
  end if;
  total_price := unit_price::bigint * target_quantity::bigint;
  if wallet_row.scroll_balance < total_price then
    raise exception 'insufficient quest scrolls' using errcode = '22003';
  end if;

  if repeatable_pet then
    select coalesce(max(existing_inventory.instance_number), 0) + 1
      into next_instance_number
      from public.child_inventory_items existing_inventory
     where existing_inventory.child_profile_id = child_row.id
       and existing_inventory.catalog_item_id = catalog_row.id;
  else
    select * into inventory_row
      from public.child_inventory_items
     where child_profile_id = child_row.id
       and catalog_item_id = catalog_row.id
       and instance_number = 1
     for update;
    inventory_found := found;
    if inventory_found and not catalog_row.is_stackable then
      raise exception 'item is already owned' using errcode = '23505';
    end if;
  end if;

  insert into public.game_item_purchases (
    family_id, child_profile_id, catalog_item_id, idempotency_key,
    quantity, unit_price, total_price, catalog_name_snapshot, catalog_type_snapshot,
    source_scene_id, source_npc_id, source_dialogue_version
  ) values (
    child_row.family_id, child_row.id, catalog_row.id, purchase_idempotency_key,
    target_quantity, unit_price, total_price, catalog_row.name, catalog_row.item_type,
    purchase_source_scene_id, target_source_npc_id, purchase_source_dialogue_version
  ) returning * into purchase_row;

  update public.child_game_wallets
     set scroll_balance = scroll_balance - total_price
   where child_profile_id = child_row.id
   returning * into wallet_row;

  insert into public.game_currency_ledger (
    family_id, child_profile_id, entry_type, amount_delta, source_purchase_id, note
  ) values (
    child_row.family_id, child_row.id, 'purchase', -total_price,
    purchase_row.id, 'game item purchase'
  );

  if repeatable_pet then
    insert into public.child_inventory_items (
      family_id, child_profile_id, catalog_item_id, quantity, acquired_via, instance_number,
      source_scene_id, source_npc_id, source_dialogue_version
    ) values (
      child_row.family_id, child_row.id, catalog_row.id, 1, 'purchase', next_instance_number,
      purchase_source_scene_id, target_source_npc_id, purchase_source_dialogue_version
    ) returning * into inventory_row;
  elsif inventory_found then
    update public.child_inventory_items inventory
       set quantity = inventory.quantity + target_quantity,
           source_scene_id = coalesce(inventory.source_scene_id, purchase_source_scene_id),
           source_npc_id = coalesce(inventory.source_npc_id, target_source_npc_id),
           source_dialogue_version = coalesce(
             inventory.source_dialogue_version, purchase_source_dialogue_version
           )
     where inventory.id = inventory_row.id
     returning * into inventory_row;
  else
    insert into public.child_inventory_items (
      family_id, child_profile_id, catalog_item_id, quantity, acquired_via, instance_number,
      source_scene_id, source_npc_id, source_dialogue_version
    ) values (
      child_row.family_id, child_row.id, catalog_row.id, target_quantity, 'purchase', 1,
      purchase_source_scene_id, target_source_npc_id, purchase_source_dialogue_version
    ) returning * into inventory_row;
  end if;

  update public.game_item_purchases
     set inventory_item_id = inventory_row.id
   where id = purchase_row.id
   returning * into purchase_row;

  return jsonb_build_object(
    'purchase_id', purchase_row.id,
    'wallet_balance', wallet_row.scroll_balance,
    'inventory_item_id', inventory_row.id,
    'quantity', inventory_row.quantity,
    'source_scene_id', purchase_row.source_scene_id,
    'source_npc_id', purchase_row.source_npc_id,
    'source_dialogue_version', purchase_row.source_dialogue_version,
    'idempotent_replay', false
  );
end;
$$;

revoke all on function private.enforce_world_source_snapshot() from public, anon, authenticated;
revoke all on function private.enforce_new_child_character() from public, anon, authenticated;
revoke all on function private.initialize_world_scene_unlocks_after_insert() from public, anon, authenticated;
revoke all on function public.unlock_world_scene_if_eligible(text, uuid) from public, anon;
grant execute on function public.unlock_world_scene_if_eligible(text, uuid) to authenticated;
revoke all on function public.complete_world_npc_dialogue(text, uuid) from public, anon;
grant execute on function public.complete_world_npc_dialogue(text, uuid) to authenticated;
revoke all on function public.purchase_game_item(uuid, integer, uuid, uuid, text) from public, anon;
grant execute on function public.purchase_game_item(uuid, integer, uuid, uuid, text) to authenticated;

commit;
