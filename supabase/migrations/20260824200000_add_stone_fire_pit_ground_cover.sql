-- Keep the fire pit pass-through while hiding meadow grass and flowers beneath
-- its circular footprint. The edge softness scales with the placed decoration.
update public.game_catalog_items
set metadata = metadata || jsonb_build_object(
  'passThrough', true,
  'groundCoverWidth', 1.2,
  'groundCoverDepth', 1.2,
  'groundCoverShape', 'circle',
  'groundCoverEdgeSoftness', 0.1
),
updated_at = timezone('utc', now())
where item_type = 'decoration'
  and asset_key = 'decoration.stone-fire-pit';
