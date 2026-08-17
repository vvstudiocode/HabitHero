-- Store the authored footprint shape separately from collision_radius.
-- collision_radius stays positive for catalog/server validation; the runtime
-- uses these dimensions for accurate character and pet navigation collision.
update public.game_catalog_items
set
  metadata = coalesce(metadata, '{}'::jsonb) || case asset_key
    when 'decoration.study-desk' then jsonb_build_object(
      'collisionShape', 'rectangle',
      'collisionWidth', 2.0,
      'collisionDepth', 1.08
    )
    when 'decoration.bookcase' then jsonb_build_object(
      'collisionShape', 'rectangle',
      'collisionWidth', 1.57,
      'collisionDepth', 0.72
    )
    when 'decoration.bed' then jsonb_build_object(
      'collisionShape', 'rectangle',
      'collisionWidth', 1.74,
      'collisionDepth', 1.99
    )
    when 'decoration.curtain-wall' then jsonb_build_object(
      'collisionShape', 'rectangle',
      'collisionWidth', 2.0,
      'collisionDepth', 0.30
    )
    when 'decoration.wall' then jsonb_build_object(
      'collisionShape', 'rectangle',
      'collisionWidth', 2.0,
      'collisionDepth', 0.30
    )
    when 'decoration.study-chair' then jsonb_build_object('collisionShape', 'circle')
    when 'decoration.fountain' then jsonb_build_object('collisionShape', 'circle')
    when 'decoration.nightstand' then jsonb_build_object('collisionShape', 'circle')
    else '{}'::jsonb
  end,
  updated_at = timezone('utc', now())
where item_type = 'decoration'
  and is_active
  and asset_key in (
    'decoration.study-desk',
    'decoration.bookcase',
    'decoration.bed',
    'decoration.curtain-wall',
    'decoration.wall',
    'decoration.study-chair',
    'decoration.fountain',
    'decoration.nightstand'
  );
