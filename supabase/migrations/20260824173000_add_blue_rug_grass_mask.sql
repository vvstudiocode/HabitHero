-- Persist the rug footprint used to suppress grass and flowers underneath it.
update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'groundCoverWidth', 1.96,
      'groundCoverDepth', 1.96,
      'groundCoverEdgeSoftness', 0.12
    ),
    updated_at = timezone('utc', now())
where item_type = 'decoration'
  and asset_key = 'decoration.blue-rug';
