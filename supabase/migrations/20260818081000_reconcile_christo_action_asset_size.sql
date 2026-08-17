-- Keep Christo's catalog size metadata aligned with the final root-motion-clean
-- GLB shipped by the app.

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'modelBytes', 1279788
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.christo';
