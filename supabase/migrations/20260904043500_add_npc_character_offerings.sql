-- Each character vendor also offers their own character catalog item. This
-- keeps the NPC, dialogue source, backpack shop, and purchase validation aligned.
begin;

with vendor(npc_id, catalog_item_id) as (values
  ('npc.gilt', 'character.gilt'),
  ('npc.moss', 'character.moss'),
  ('npc.lunalia', 'character.lunalia'),
  ('npc.noah', 'character.noah'),
  ('npc.collette', 'character.collette'),
  ('npc.violette', 'character.violette')
)
update public.game_world_npc_offerings offering
   set sort_order = offering.sort_order + 1,
       updated_at = timezone('utc', now())
  from vendor
 where offering.npc_id = vendor.npc_id
   and offering.is_active
   and offering.is_primary_source
   and not exists (
     select 1
       from public.game_world_npc_offerings existing
      where existing.npc_id = vendor.npc_id
        and existing.catalog_item_id = (
          select item.id
            from public.game_catalog_items item
           where item.asset_key = vendor.catalog_item_id
        )
        and existing.is_active
        and existing.is_primary_source
   );

insert into public.game_world_npc_offerings
  (npc_id, catalog_item_id, sort_order, dialogue_version, is_primary_source)
select npc.id, npc.catalog_item_id, 1, 1, true
  from public.game_world_npcs npc
 where npc.npc_type = 'character_vendor'
   and npc.is_active
   and npc.catalog_item_id is not null
on conflict (npc_id, catalog_item_id) do update set
  sort_order = 1,
  dialogue_version = 1,
  is_primary_source = true,
  is_active = true,
  updated_at = timezone('utc', now());

do $$
begin
  if (select count(*)
        from public.game_world_npc_offerings offering
        join public.game_world_npcs npc on npc.id = offering.npc_id
       where npc.npc_type = 'character_vendor'
         and npc.is_active
         and offering.catalog_item_id = npc.catalog_item_id
         and offering.is_active
         and offering.is_primary_source) <> 6 then
    raise exception 'character NPC self-offering seed cardinality is invalid';
  end if;
end;
$$;

commit;
