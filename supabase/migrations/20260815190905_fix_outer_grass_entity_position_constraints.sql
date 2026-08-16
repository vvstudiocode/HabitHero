-- Keep player and pet transforms inside the walkable area while allowing
-- decoration centers anywhere on the visible outer meadow. The RPC still
-- applies the scaled collision radius before accepting a final transform.

alter table public.child_world_entities
  drop constraint if exists child_world_entities_position_x_check;

alter table public.child_world_entities
  add constraint child_world_entities_position_x_check check (
    (entity_kind = 'decoration' and position_x between -13.475 and 13.475)
    or (entity_kind <> 'decoration' and position_x between -5 and 5)
  );

alter table public.child_world_entities
  drop constraint if exists child_world_entities_position_z_check;

alter table public.child_world_entities
  add constraint child_world_entities_position_z_check check (
    (entity_kind = 'decoration' and position_z between -13.475 and 13.475)
    or (entity_kind <> 'decoration' and position_z between -5 and 5)
  );
