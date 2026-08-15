-- Keep pet names readable and consistently anchored above each model head.
-- The runtime compensates for the model root scale so labels do not grow with
-- the selected pet's visual multiplier.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'nameLabelPlacement', 'above-head',
      'nameLabelScaleMultiplier', 0.55
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and is_active = true;

-- Re-assert the supplied pets explicitly so their presentation contract stays
-- intact even if a future catalog edit changes active-state filtering.
update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'nameLabelPlacement', 'above-head',
      'nameLabelScaleMultiplier', 0.55
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key in ('pet.star-diver', 'pet.christo', 'pet.nibus');

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('visualScaleMultiplier', 2),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.moko';

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('visualScaleMultiplier', 4),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.kaldo';

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('visualScaleMultiplier', 2),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.orian';

commit;
