begin;

update public.game_catalog_items
set metadata = (
      coalesce(metadata, '{}'::jsonb) - 'idlePauseSeconds'
    ) || jsonb_build_object(
      'walkOnlyPauseMinSeconds', 3,
      'walkOnlyPauseMaxSeconds', 5
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and is_active = true
  and nullif(metadata->>'idleAnimation', '') is null;

commit;
