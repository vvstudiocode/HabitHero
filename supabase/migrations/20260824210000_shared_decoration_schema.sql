-- Shared decorations are placements, not transfers. The source inventory item
-- remains owned by its child and one source item may be shown in many worlds.
create table public.child_world_decoration_collaborators (
  world_owner_child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  collaborator_child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  can_collaborate boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (world_owner_child_profile_id, collaborator_child_profile_id),
  check (world_owner_child_profile_id <> collaborator_child_profile_id)
);

create table public.child_shared_world_decorations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  world_owner_child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  source_child_profile_id uuid not null references public.child_profiles(id) on delete cascade,
  source_inventory_item_id uuid not null references public.child_inventory_items(id) on delete cascade,
  world_layout_version smallint not null default 1 check (world_layout_version >= 1),
  position_x numeric(8,3) not null check (position_x between -13.475 and 13.475),
  position_y numeric(8,3) not null check (position_y between -2 and 5),
  position_z numeric(8,3) not null check (position_z between -13.475 and 13.475),
  rotation_x numeric(8,4) not null default 0 check (rotation_x between -6.284 and 6.284),
  rotation_y numeric(8,4) not null default 0 check (rotation_y between -6.284 and 6.284),
  rotation_z numeric(8,4) not null default 0 check (rotation_z between -6.284 and 6.284),
  scale numeric(5,3) not null default 1 check (scale between 0.1 and 3),
  behavior_mode text not null default 'static' check (behavior_mode = 'static'),
  is_active boolean not null default true,
  removed_reason text check (removed_reason is null or removed_reason in ('source_withdrew', 'owner_removed', 'friendship_removed', 'blocked', 'source_unavailable', 'catalog_inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  foreign key (family_id, world_owner_child_profile_id) references public.child_profiles(family_id, id) on delete cascade,
  check (world_owner_child_profile_id <> source_child_profile_id),
  check ((is_active and removed_reason is null) or (not is_active and removed_reason is not null))
);

create unique index child_shared_world_decorations_source_world_unique on public.child_shared_world_decorations (world_owner_child_profile_id, source_inventory_item_id)
  where is_active;
create index if not exists child_shared_world_decorations_world_active_idx
  on public.child_shared_world_decorations (world_owner_child_profile_id, is_active, updated_at desc);
create index if not exists child_shared_world_decorations_source_active_idx
  on public.child_shared_world_decorations (source_child_profile_id, is_active);

alter table public.child_world_decoration_collaborators enable row level security;
alter table public.child_shared_world_decorations enable row level security;
revoke all on table public.child_world_decoration_collaborators, public.child_shared_world_decorations from public, anon, authenticated;
revoke all on table public.child_world_decoration_collaborators from public, anon, authenticated;
revoke all on table public.child_shared_world_decorations from public, anon, authenticated;

do $$
begin
  if to_regprocedure('private.touch_updated_at()') is not null then
    execute 'drop trigger if exists child_world_decoration_collaborators_updated_at on public.child_world_decoration_collaborators';
    execute 'create trigger child_world_decoration_collaborators_updated_at before update on public.child_world_decoration_collaborators for each row execute function private.touch_updated_at()';
    execute 'drop trigger if exists child_shared_world_decorations_updated_at on public.child_shared_world_decorations';
    execute 'create trigger child_shared_world_decorations_updated_at before update on public.child_shared_world_decorations for each row execute function private.touch_updated_at()';
  end if;
end;
$$;
