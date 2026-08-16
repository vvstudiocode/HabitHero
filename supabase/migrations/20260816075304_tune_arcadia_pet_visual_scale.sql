-- Increase Arcadia's authored world presentation size without changing its
-- compact GLB, collision data, or the shared roaming/following actor logic.
update public.game_catalog_items
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{visualScaleMultiplier}',
  '3.4'::jsonb,
  true
),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.arcadia';
