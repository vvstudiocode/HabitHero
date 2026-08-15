begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'hideGroundMarker', true,
      'groundOffset', -0.12
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key in ('pet.nibus', 'pet.christo');

commit;
