-- Make 艾莉特 two times larger in the world while keeping the shop preview's
-- normalized framing unchanged. The runtime applies this metadata to both
-- following and roaming pet actors.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'visualScaleMultiplier', 2
    ),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.ailite';

commit;
