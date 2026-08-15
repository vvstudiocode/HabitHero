-- The repaired Moko GLB keeps the original GLB chunks intact while fixing
-- walk root motion in place. Record the resulting byte count for diagnostics.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'modelBytes', 1842948,
      'glbPostprocess', 'in-place root accessor patch; original JSON/BIN chunks preserved'
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.moko';

commit;
