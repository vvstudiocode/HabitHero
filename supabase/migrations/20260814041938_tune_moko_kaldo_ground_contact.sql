-- Keep Moko's authored Idle contact unchanged and lower it only while its
-- walking action is active. Kaldo needs a small overall grounding correction.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('walkingGroundOffset', -0.04),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.moko';

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('groundOffset', -0.32),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.kaldo';

commit;
