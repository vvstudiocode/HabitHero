begin;

-- Keep Arcadia in the open plaza in front of the notice board. The original
-- scene/NPC migration remains the schema and seed owner; this migration only
-- corrects the authored placement after the 3D layout was verified.
update public.game_world_npcs
set position_x = 3.2,
    position_z = -0.8,
    roam_bounds = jsonb_build_object(
      'minX', 1.8,
      'maxX', 4.6,
      'minZ', -2.2,
      'maxZ', 0.9
    ),
    updated_at = timezone('utc', now())
where id = 'npc.arcadia'
  and scene_id = 'sunrise-village'
  and npc_type = 'roaming_pet'
  and asset_key = 'pet.arcadia';

commit;
