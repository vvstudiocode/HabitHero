-- Record the seam-preserving rebuild of the bedroom decoration assets.
-- The existing catalog rows keep their stable asset keys and URLs; only
-- optimization metadata changes here.

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'triangleCount', 15505,
      'textureSize', 1024,
      'simplificationRatio', 0.0259,
      'compression', 'Draco geometry + WebP textures + seam-preserving attribute-aware mesh simplification + MikkTSpace tangents'
    ),
    updated_at = timezone('utc', now())
where item_type = 'decoration'
  and asset_key = 'decoration.bed';

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'triangleCount', 8511,
      'textureSize', 1024,
      'simplificationRatio', 0.022,
      'compression', 'Draco geometry + WebP textures + seam-preserving attribute-aware mesh simplification + MikkTSpace tangents'
    ),
    updated_at = timezone('utc', now())
where item_type = 'decoration'
  and asset_key = 'decoration.nightstand';
