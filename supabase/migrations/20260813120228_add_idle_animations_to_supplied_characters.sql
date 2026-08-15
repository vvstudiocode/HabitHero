-- Keep the existing character catalog, inventory, and loadouts intact while
-- advertising the newly bundled authored Idle clip for the four original
-- supplied characters.
begin;

update public.game_catalog_items as item
set metadata = item.metadata
  || jsonb_build_object(
    'source', case item.asset_key
      when 'character.arthur' then 'User-provided 亞瑟.fbx + 亞瑟Idle.fbx'
      when 'character.elina' then 'User-provided 艾利娜.fbx + 艾利娜Idle.fbx'
      when 'character.sia' then 'User-provided 希雅.fbx + 希雅Idle.fbx'
      when 'character.elio' then 'User-provided 艾利歐.fbx + 艾利歐Idle .fbx'
    end,
    'animation', 'Walk_InPlace',
    'idleAnimation', 'Idle',
    'animationStates', jsonb_build_array('idle', 'walk'),
    'renderMode', 'animated-glb',
    'visualStyle', 'warm-hand-painted',
    'compression', 'Draco mesh compression + WebP textures'
  ),
  updated_at = timezone('utc', now())
where item_type = 'character'
  and asset_key in (
    'character.arthur',
    'character.elina',
    'character.sia',
    'character.elio'
  );

commit;
