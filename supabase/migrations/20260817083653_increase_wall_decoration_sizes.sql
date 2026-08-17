-- Give both wall decorations a larger default presentation and a larger
-- selectable maximum while keeping their small positive navigation proxies.
update public.game_catalog_items
set
  max_scale = 1.5,
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('defaultScale', 0.72),
  updated_at = timezone('utc', now())
where item_type = 'decoration'
  and asset_key in ('decoration.curtain-wall', 'decoration.wall');
