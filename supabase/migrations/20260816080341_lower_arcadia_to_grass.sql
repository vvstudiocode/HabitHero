-- The enlarged Arcadia has a larger authored idle foot lift. Lower its actor
-- root so both idle and walk poses make contact with the grass.
update public.game_catalog_items
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{groundOffset}',
  '-0.44'::jsonb,
  true
),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.arcadia';
