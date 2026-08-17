-- Let characters approach the visible decoration surface while retaining a
-- positive collider. Runtime subtracts this inset from the character radius;
-- the character center still cannot cross the shape boundary.
update public.game_catalog_items
set
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('navigationInset', 0.15),
  updated_at = timezone('utc', now())
where item_type = 'decoration'
  and is_active;
