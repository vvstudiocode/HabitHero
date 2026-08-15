-- Keep the Belilos fox asset and ownership records intact while shortening its
-- player-facing catalog name.

begin;

update public.game_catalog_items
set name = '貝里洛斯',
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.belilos-fox';

commit;
