update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'visualScaleMultiplier', 8.0 / 3.0,
      'movementSpeedMultiplier', 0.6
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.yaoguang-deer';
