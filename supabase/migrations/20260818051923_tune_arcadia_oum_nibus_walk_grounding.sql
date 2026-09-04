-- Keep the three supplied pets on the grass while their roaming Walk clip is
-- active. Their action clips already use the normal ground baseline, so this
-- correction is intentionally walking-only.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || case asset_key
      when 'pet.arcadia' then jsonb_build_object('walkingGroundOffset', 0.03)
      when 'pet.oum' then jsonb_build_object('walkingGroundOffset', 0.012)
      when 'pet.nibus' then jsonb_build_object('walkingGroundOffset', 0.006)
    end,
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key in ('pet.arcadia', 'pet.oum', 'pet.nibus');

commit;
