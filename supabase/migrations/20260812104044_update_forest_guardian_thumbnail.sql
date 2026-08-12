update public.game_catalog_items
set
  thumbnail_url = '/assets/forest-guardian-thumbnail.png',
  metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{thumbnail}',
    to_jsonb('/assets/forest-guardian-thumbnail.png'::text),
    true
  ),
  updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.starlight-sprout';
