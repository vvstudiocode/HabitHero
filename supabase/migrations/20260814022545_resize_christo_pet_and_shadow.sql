begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'visualScaleMultiplier', 2,
      'groundShadowScaleMultiplier', 0.22,
      'nameLabelScaleMultiplier', 0.33
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.christo';

commit;
