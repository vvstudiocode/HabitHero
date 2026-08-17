-- Keep Jasmine readable at the requested 2x presentation size while placing
-- the feet into the grass base and removing both pet shadow implementations.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'visualScaleMultiplier', 2,
      'groundOffset', -0.22,
      'hideGroundShadow', true,
      'hideGroundMarker', true
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.jasmine';

commit;
