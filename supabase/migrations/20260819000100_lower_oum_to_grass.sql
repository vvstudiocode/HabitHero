-- Lower Oum's enlarged actor root so both Idle and Walk sit in the grass
-- instead of resting at the tips of the meadow blades.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('groundOffset', -0.36),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.oum';

commit;
