begin;

update public.game_catalog_items
set metadata = jsonb_set(
  coalesce(metadata, '{}'::jsonb),
  '{idlePauseSeconds}',
  '10'::jsonb,
  true
)
where item_type = 'pet'
  and is_active = true;

commit;
