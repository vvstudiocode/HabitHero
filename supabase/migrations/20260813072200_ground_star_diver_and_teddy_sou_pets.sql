begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
              'groundOffset', -0.05
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key in ('pet.star-diver', 'pet.teddy-sou');

commit;
