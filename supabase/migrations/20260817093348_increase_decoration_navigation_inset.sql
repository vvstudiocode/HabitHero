-- Increase the approach allowance so characters can get closer to the
-- decoration surface without disabling its shape collider.
update public.game_catalog_items
set
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('navigationInset', 0.25),
  updated_at = timezone('utc', now())
where item_type = 'decoration'
  and is_active;
