-- Fine-tune Kaldo's overall contact after the first grounding pass.

begin;

update public.game_catalog_items
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('groundOffset', -0.36),
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key = 'pet.kaldo';

commit;
