-- Keep world rotations visually equivalent but bounded before the table check
-- constraint evaluates them. This protects every database write path, not only
-- the current placement UI.

create or replace function private.normalize_world_rotation(target_rotation numeric)
returns numeric
language sql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
  select mod(
    mod(target_rotation + 3.141592653589793, 6.283185307179586)
      + 6.283185307179586,
    6.283185307179586
  ) - 3.141592653589793;
$$;

create or replace function private.normalize_world_entity_rotations()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  new.rotation_x := private.normalize_world_rotation(new.rotation_x);
  new.rotation_y := private.normalize_world_rotation(new.rotation_y);
  new.rotation_z := private.normalize_world_rotation(new.rotation_z);
  return new;
end;
$$;

drop trigger if exists child_world_entities_normalize_rotations on public.child_world_entities;

create trigger child_world_entities_normalize_rotations
before insert or update of rotation_x, rotation_y, rotation_z
on public.child_world_entities
for each row
execute function private.normalize_world_entity_rotations();

revoke all on function private.normalize_world_rotation(numeric) from public, anon, authenticated;
revoke all on function private.normalize_world_entity_rotations() from public, anon, authenticated;
