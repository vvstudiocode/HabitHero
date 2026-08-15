-- Keep the supplied pets identifiable in-world and tune their presentation.
-- The selected follower is promoted in the client queue; these catalog values
-- are shared by roaming and following instances.

begin;

update public.game_catalog_items
set description = '穿著深海潛水裝、用慢步伐陪你探索冒險世界的潛水夥伴。',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'visualScaleMultiplier', 2,
      'movementSpeedMultiplier', 0.65,
      'hideGroundShadow', true
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.star-diver';

update public.game_catalog_items
set description = '帶著暖暖麵包香、用慢步伐陪你探索冒險世界的麵包狗夥伴。',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'visualScaleMultiplier', 2,
      'movementSpeedMultiplier', 0.7,
      'hideGroundShadow', true
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.teddy-sou';

commit;
