-- Add the user-provided transparent shop thumbnails for the animated pets.

begin;

update public.game_catalog_items
set thumbnail_url = case asset_key
      when 'pet.silf-owl' then '/assets/pets/silf-owl-thumbnail.png'
      when 'pet.yaoguang-deer' then '/assets/pets/yaoguang-deer-thumbnail.png'
      else thumbnail_url
    end,
    metadata = coalesce(metadata, '{}'::jsonb) || case asset_key
      when 'pet.silf-owl' then jsonb_build_object(
        'thumbnail', '/assets/pets/silf-owl-thumbnail.png',
        'thumbnailPending', false
      )
      when 'pet.yaoguang-deer' then jsonb_build_object(
        'thumbnail', '/assets/pets/yaoguang-deer-thumbnail.png',
        'thumbnailPending', false
      )
      else '{}'::jsonb
    end,
    updated_at = timezone('utc', now())
where item_type = 'pet'
  and asset_key in ('pet.silf-owl', 'pet.yaoguang-deer');

commit;
