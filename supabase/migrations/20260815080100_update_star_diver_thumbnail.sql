-- Replace the Star Diver shop/backpack thumbnail with the supplied transparent PNG.

begin;

update public.game_catalog_items
set thumbnail_url = '/assets/pets/star-diver-thumbnail.png',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'thumbnail', '/assets/pets/star-diver-thumbnail.png'
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.star-diver';

commit;
