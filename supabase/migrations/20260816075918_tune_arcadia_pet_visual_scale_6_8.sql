-- Double Arcadia's current 3.4x presentation size to 6.8x without changing
-- its compact GLB, animations, collision data, or actor movement logic.
update public.game_catalog_items
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{visualScaleMultiplier}',
  '6.8'::jsonb,
  true
),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.arcadia';
