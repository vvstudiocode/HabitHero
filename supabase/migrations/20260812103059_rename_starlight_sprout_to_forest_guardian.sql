update public.game_catalog_items
set
  name = '森林守護者',
  description = '守護森林、陪伴冒險的森林守護者。',
  thumbnail_url = '/assets/starlight-sprout-pet-thumbnail.png',
  metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{thumbnail}',
    to_jsonb('/assets/starlight-sprout-pet-thumbnail.png'::text),
    true
  ),
  updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.starlight-sprout';
