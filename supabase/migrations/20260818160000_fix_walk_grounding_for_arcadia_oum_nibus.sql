-- Keep the supplied pet walk clips on their first-frame vertical root plane.
-- Their authored walk root had vertical drift, which made the models sink
-- below the grass while idle/action clips remained correctly grounded.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || case asset_key
      when 'pet.arcadia' then jsonb_build_object(
        'modelBytes', 700736,
        'walkRootVerticalMotion', 'first-frame-constant'
      )
      when 'pet.oum' then jsonb_build_object(
        'modelBytes', 1142448,
        'walkRootVerticalMotion', 'first-frame-constant'
      )
      when 'pet.nibus' then jsonb_build_object(
        'modelBytes', 964116,
        'walkRootVerticalMotion', 'first-frame-constant'
      )
    end,
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key in ('pet.arcadia', 'pet.oum', 'pet.nibus');

commit;
