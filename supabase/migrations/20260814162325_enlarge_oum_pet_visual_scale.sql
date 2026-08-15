-- Make Oum four times larger than its previous in-world presentation.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('visualScaleMultiplier', 4),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.oum';

commit;
