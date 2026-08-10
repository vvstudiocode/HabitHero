-- Fixed developer-maintained catalog and starter initialization.

insert into public.game_catalog_items (
  item_type, name, description, scroll_price, asset_key, is_active,
  is_starter, is_stackable, collision_radius, min_scale, max_scale, sort_order, metadata
) values
  ('character', '動漫少女', 'HabitHero 世界的免費初始角色。', 0, 'character.anime-maiden', true, true, false, 0.28, 0.9, 1.1, 10, '{"source":"terrain-prototype/assets/anime-maiden.glb"}'::jsonb),
  ('character', '星光冒險家', '可用卷軸兌換的明亮冒險角色。', 8, 'character.starlight-adventurer', true, false, false, 0.28, 0.9, 1.1, 15, '{"primitive":"character","preview":"starlight"}'::jsonb),
  ('pet', '森林小狐', '會在世界邊緣輕快閒逛的小夥伴。', 4, 'pet.forest-fox', true, false, false, 0.32, 0.75, 1.35, 20, '{"primitive":"fox"}'::jsonb),
  ('pet', '雲朵小鳥', '喜歡在樹邊待機的天空朋友。', 5, 'pet.cloud-bird', true, false, false, 0.24, 0.75, 1.35, 30, '{"primitive":"bird"}'::jsonb),
  ('decoration', '小花燈', '放在草地上的暖色小燈。', 2, 'decoration.flower-lantern', true, false, true, 0.38, 0.7, 1.5, 40, '{"primitive":"lantern","color":"amber"}'::jsonb),
  ('decoration', '蘑菇椅', '一張可以讓世界變可愛的蘑菇椅。', 3, 'decoration.mushroom-stool', true, false, true, 0.48, 0.7, 1.4, 50, '{"primitive":"mushroom","color":"coral"}'::jsonb),
  ('decoration', '冒險旗幟', '標記今天完成任務的地方。', 3, 'decoration.adventure-flag', true, false, true, 0.3, 0.75, 1.5, 60, '{"primitive":"flag","color":"teal"}'::jsonb)
on conflict (item_type, asset_key) do nothing;

do $$
declare
  child_row public.child_profiles;
begin
  for child_row in select * from public.child_profiles loop
    perform private.initialize_child_game_data(child_row.family_id, child_row.id);
  end loop;
end;
$$;

create or replace function private.initialize_child_game_data_after_insert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  perform private.initialize_child_game_data(new.family_id, new.id);
  return new;
end;
$$;

drop trigger if exists child_game_data_initializer on public.child_profiles;
create trigger child_game_data_initializer
  after insert on public.child_profiles
  for each row execute function private.initialize_child_game_data_after_insert();

revoke all on function private.initialize_child_game_data_after_insert() from public, anon, authenticated;
