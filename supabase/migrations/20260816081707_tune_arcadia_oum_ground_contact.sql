-- Make the final small grounding adjustments after the enlarged pet tuning.
update public.game_catalog_items
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{groundOffset}',
  '-0.50'::jsonb,
  true
),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.arcadia';

update public.game_catalog_items
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{groundOffset}',
  '-0.32'::jsonb,
  true
),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.oum';
