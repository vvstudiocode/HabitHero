-- Adjust the in-world visual scale without changing the shipped GLB files.
-- The runtime multiplies this by its normal pet-size normalization factor.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || case asset_key
      when 'pet.buleifu-tiger' then jsonb_build_object('visualScaleMultiplier', 3.0)
      when 'pet.belilos-fox' then jsonb_build_object('visualScaleMultiplier', 2.0)
      else '{}'::jsonb
    end,
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key in ('pet.buleifu-tiger', 'pet.belilos-fox');

commit;
