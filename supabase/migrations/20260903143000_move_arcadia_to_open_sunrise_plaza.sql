begin;

-- Keep Arcadia away from the authored notice-board collision and give the
-- roaming pet a clear, scene-sized patrol rectangle in the right plaza.
update public.game_world_npcs
set position_x = 4.1,
    position_z = -1.7,
    roam_bounds = jsonb_build_object(
      'minX', 3.1,
      'maxX', 5.8,
      'minZ', -2.7,
      'maxZ', 1.7
    ),
    updated_at = timezone('utc', now())
where id = 'npc.arcadia'
  and scene_id = 'sunrise-village'
  and npc_type = 'roaming_pet'
  and asset_key = 'pet.arcadia';

commit;
