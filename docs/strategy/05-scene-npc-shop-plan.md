# 五大場景 NPC 商店與解鎖實作計畫

> 狀態：已核對專案，待實作
>
> 本文件只規劃場景解鎖、NPC、巡遊寵物與冒險卷商店。本輪不建立訂閱、IAP 或付款流程。

## 1. 實作目標

這項功能建立以下遊玩循環：

```text
完成冒險 → 解鎖場景 → 尋找 NPC 或寵物 → 對話
→ 使用冒險卷購買 → 商品進入目前小孩的背包
```

本計畫供後續產品、前端、Three.js runtime、Supabase migration 與測試工作使用。

## 2. 已確定的產品規則

以下規則是實作基準：

1. 家長建立新小孩時，只能選擇亞瑟、艾利娜、希雅、艾利歐
2. 既有測試帳號保留目前角色，包括六位非建立選項角色
3. 吉爾特、莫斯、露娜莉亞、諾亞、柯蕾特、薇歐莉特作為場景人物 NPC
4. 人物 NPC 固定在場景錨點並持續跳舞
5. 對話或商店開啟時，人物 NPC 仍持續跳舞
6. 寵物在所屬場景巡遊，玩家可和寵物對話
7. 人物 NPC 與巡遊寵物都能開啟對應商品
8. 所有新商品都先用冒險卷購買
9. 商品購買、背包與場景解鎖都屬於目前小孩
10. 十隻舊寵物停止新取得，但既有測試帳號繼續擁有及使用
11. 舊寵物的資產、runtime、資料與必要測試全部保留
12. 本計畫不建立訂閱、IAP、付款商品、家庭付費權益或付款請求

## 3. 新建小孩的角色規則

### 3.1 可建立角色

| 名稱 | 角色 ID | 新建小孩 | 既有帳號 |
|---|---|---:|---:|
| 亞瑟 | `character.arthur` | 可選 | 保留 |
| 艾利娜 | `character.elina` | 可選 | 保留 |
| 希雅 | `character.sia` | 可選 | 保留 |
| 艾利歐 | `character.elio` | 可選 | 保留 |
| 吉爾特 | `character.gilt` | 不可選 | 保留 |
| 莫斯 | `character.moss` | 不可選 | 保留 |
| 露娜莉亞 | `character.lunalia` | 不可選 | 保留 |
| 諾亞 | `character.noah` | 不可選 | 保留 |
| 柯蕾特 | `character.collette` | 不可選 | 保留 |
| 薇歐莉特 | `character.violette` | 不可選 | 保留 |

實作時不能縮減 `WORLD_CHARACTER_CATALOG`。完整目錄仍供既有帳號、NPC、好友世界與資產解析使用。

前端新增 `CHILD_CREATION_CHARACTER_IDS` 或等價 selector，只讓建立表單呈現四位。後端同時驗證新 `child_profiles.character_id`，不能只依賴前端。

### 3.2 既有帳號相容規則

- 不更新既有 `child_profiles.character_id`
- 不替換既有角色 loadout
- 不刪除六位人物的 catalog item、GLB 或縮圖
- 不從既有背包移除人物
- 不阻止既有測試帳號繼續裝備人物
- 新限制只套用到 migration 上線後建立的小孩

## 4. 五座場景解鎖條件

解鎖以每個小孩的 `tasks` 計算。專案目前已有 `child_profile_id`、`status` 與 `adventure_type`，所以第一版不引用不存在的成長里程碑資料表。

| 順序 | 場景 | 場景 ID | 解鎖條件 |
|---:|---|---|---|
| 1 | 晨光村 | `sunrise-village` | 建立小孩後直接解鎖 |
| 2 | 森語谷 | `forest-valley` | 累計 5 個已核准冒險 |
| 3 | 雲工房 | `cloud-workshop` | 累計 12 個已核准冒險，其中 2 個為一般冒險 |
| 4 | 潮光群島 | `tideglow-archipelago` | 累計 20 個已核准冒險，其中 5 個為一般冒險 |
| 5 | 星砂荒原 | `star-sand-wasteland` | 累計 30 個已核准冒險，其中 10 個為一般冒險 |

只計算 `status = 'completed'` 的家長核准冒險。一般冒險數只計算 `adventure_type = 'general'`。

後續調整門檻時增加 `unlock_rule_version`。已解鎖場景永久保留，不因門檻調整而重新鎖定。

### 4.1 解鎖行為

- 地圖顯示所有場景
- 鎖定場景顯示條件、目前完成數與剩餘數量
- 前端只顯示進度，RPC 才決定權限
- 每個小孩各自解鎖，家庭內不共享進度

## 5. 場景內容配置

### 5.1 人物、寵物與裝飾

| 場景 | 人物 NPC | 巡遊寵物 | 裝飾 |
|---|---|---|---|
| 晨光村 | 吉爾特 | 歐姆、阿卡迪亞 | 床、床頭櫃、沙發、腳印地毯 |
| 森語谷 | 莫斯、露娜莉亞 | 茉莉、齊福爾 | 石火堆、噴泉、拼布地毯、牆面 |
| 雲工房 | 諾亞 | 尼布斯、奧利安 | 電腦桌、書桌、書桌椅、電競椅 |
| 潮光群島 | 柯蕾特 | 克里斯多 | 藍色地毯、薰衣草花紋地毯、落地燈 |
| 星砂荒原 | 薇歐莉特 | 卡爾多、莫可 | 書櫃、窗簾牆、王室徽章地毯 |

裝飾共 18 件，採 4、4、4、3、3 分配。石火堆固定在森語谷。`decoration.adventure-table` 是核心入口，不放入場景商店。

### 5.2 裝飾資產 key

| 場景 | 資產 key |
|---|---|
| 晨光村 | `decoration.bed`、`decoration.nightstand`、`decoration.sofa`、`decoration.pawprint-rug` |
| 森語谷 | `decoration.stone-fire-pit`、`decoration.fountain`、`decoration.patchwork-rug`、`decoration.wall` |
| 雲工房 | `decoration.computer-desk`、`decoration.study-desk`、`decoration.study-chair`、`decoration.gaming-chair` |
| 潮光群島 | `decoration.blue-rug`、`decoration.lavender-pattern-rug`、`decoration.floor-lamp` |
| 星砂荒原 | `decoration.bookcase`、`decoration.curtain-wall`、`decoration.royal-crest-rug` |

### 5.3 人物 NPC 的商品分工

每件商品設定一位主要人物 NPC。商店的「在哪裡購買」使用主要人物 NPC。

| 人物 NPC | 主要商品 |
|---|---|
| 吉爾特 | 歐姆、阿卡迪亞、床、床頭櫃、沙發、腳印地毯 |
| 莫斯 | 茉莉、齊福爾、石火堆 |
| 露娜莉亞 | 噴泉、拼布地毯、牆面 |
| 諾亞 | 尼布斯、奧利安、電腦桌、書桌、書桌椅、電競椅 |
| 柯蕾特 | 克里斯多、藍色地毯、薰衣草花紋地毯、落地燈 |
| 薇歐莉特 | 卡爾多、莫可、書櫃、窗簾牆、王室徽章地毯 |

每隻巡遊寵物也提供自己的寵物商品。玩家可找主要人物 NPC，也可直接和該寵物對話。

## 6. NPC 與巡遊寵物行為

### 6.1 人物 NPC

- 場景載入完成後立即出現
- 固定在商店錨點
- 持續播放 `Dance` loop
- 對話與商店開啟時不停止動畫
- 對話 UI 不得卸載 NPC runtime
- 模型沒有 `Dance` 時使用 `Idle` loop，並記錄警告
- 不使用會讓 NPC 離開錨點的 root motion

### 6.2 巡遊寵物

- 在場景的可行走範圍內巡遊
- 避開牆面、商店錨點、傳送點與不可走區域
- 玩家進入互動距離後顯示對話提示
- 開始對話時暫停該寵物
- 關閉對話後恢復巡遊
- 購買後，場景展示寵物仍然保留
- 購買的寵物進入目前小孩的背包

目前寵物呈現屬於 golden baseline。巡遊 NPC 要重用現有模型、ground、scale、shadow、label 與動畫 metadata，不重新調整既有寵物資產。

## 7. 對話與購買流程

### 7.1 場景內流程

1. 玩家進入已解鎖場景
2. 玩家點擊人物 NPC 或巡遊寵物
3. 系統驗證互動目標屬於目前場景
4. 系統開啟對話並記錄目前小孩的對話進度
5. 對話完成後顯示該 NPC 的 active offering
6. 玩家使用冒險卷購買
7. RPC 重新驗證小孩、場景、NPC、offering、價格與餘額
8. 系統在同一交易中扣款、寫入購買紀錄並新增背包物品
9. 背包保存實際購買的場景與 NPC

### 7.2 商店與背包顯示

全域商店仍可瀏覽商品，但不得繞過場景規則。

| 商品狀態 | 顯示方式 |
|---|---|
| 場景未解鎖 | 顯示場景與解鎖條件，不顯示購買按鈕 |
| 場景已解鎖但未對話 | 顯示「前往場景和 NPC 對話」 |
| 已完成對話 | 顯示冒險卷價格與購買按鈕 |
| 已擁有 | 顯示實際取得場景與 NPC |
| 舊版商品沒有來源快照 | 顯示「早期取得」 |
| 舊寵物且未擁有 | 不顯示於新商店 |
| 舊寵物且已擁有 | 保留於背包並可繼續使用 |

來源文字範例：

- 「晨光村，找吉爾特」
- 「森語谷，找露娜莉亞」
- 「雲工房，也可以直接和尼布斯對話」

## 8. 資料擁有權

| 資料 | 範圍 | 規則 |
|---|---|---|
| 場景內容 | 全域 | 所有家庭使用相同場景、NPC 與 offering |
| 場景解鎖 | 每個小孩 | 不和兄弟姊妹共享 |
| NPC 對話進度 | 每個小孩 | 每個小孩各自發現商品 |
| 冒險卷錢包 | 每個小孩 | 從目前小孩扣除 |
| 購買紀錄 | 每個小孩 | 保存實際場景與 NPC |
| 背包 | 每個小孩 | 商品只進入目前小孩背包 |
| 既有測試角色 | 既有小孩 | 不修改、不撤回 |
| 既有舊寵物 | 既有小孩 | 保留擁有權與使用能力 |

現有 `child_game_wallets`、`game_item_purchases` 與 `child_inventory_items` 已使用 `child_profile_id`。新功能維持相同邊界。

## 9. 建議資料模型

### 9.1 全域內容資料

`game_world_scenes` 保存場景 ID、名稱、排序、解鎖條件、規則版本與 active 狀態。

`game_world_npcs` 保存場景、NPC 類型、名稱、資產 key、位置、巡遊邊界、行為與動畫。

`game_world_npc_offerings` 是商品來源的唯一真相，保存：

- NPC 與 catalog item 關聯
- 顯示排序
- 對話版本
- 是否為全域商店顯示的主要來源
- active 狀態

不要再把場景或 NPC 來源重複存進 `game_catalog_items`。全域商店由 offering 查詢主要來源，避免兩份資料不一致。

### 9.2 每個小孩的進度

`child_world_scene_unlocks` 保存永久解鎖紀錄。

`child_world_npc_dialogue_progress` 保存第一次與最近一次對話時間。

`game_item_purchases` 與 `child_inventory_items` 新增 nullable 來源快照：

- `source_scene_id`
- `source_npc_id`
- `source_dialogue_version`

既有資料保持 null，UI 顯示「早期取得」。不要猜測或回填不存在的歷史來源。

### 9.3 Catalog 相容欄位

`game_catalog_items` 新增：

- `is_child_creation_selectable boolean not null default false`
- `is_newly_obtainable boolean not null default true`

`is_child_creation_selectable` 只控制新建小孩選單。`is_newly_obtainable` 只控制能否新購買或新贈送。

不要把舊寵物的 `is_active` 設為 false。現有前端會依 `is_active` 過濾內容，設為 false 可能讓測試帳號已擁有的寵物消失。

## 10. SQL migration 草稿

> 以下 SQL 是實作草稿，這次不執行。正式使用前必須依 [Supabase migration 與部署規則](/Users/studio.vv/Desktop/HabitHero/docs/supabase-migration-and-deployment.md) 稽核 migration history，並在本地資料庫驗證。

### 10.1 場景、NPC 與 offering

```sql
create table public.game_world_scenes (
  id text primary key,
  name text not null,
  sort_order integer not null unique,
  required_completed_count integer not null default 0
    check (required_completed_count >= 0),
  required_general_count integer not null default 0
    check (required_general_count >= 0),
  unlock_rule_version integer not null default 1
    check (unlock_rule_version > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (required_general_count <= required_completed_count)
);
```

```sql
create table public.game_world_npcs (
  id text primary key,
  scene_id text not null
    references public.game_world_scenes(id) on delete restrict,
  npc_type text not null
    check (npc_type in ('character_vendor', 'roaming_pet')),
  name text not null,
  asset_key text not null,
  catalog_item_id uuid
    references public.game_catalog_items(id) on delete restrict,
  position_x numeric(8,3) not null default 0,
  position_y numeric(8,3) not null default 0,
  position_z numeric(8,3) not null default 0,
  behavior_mode text not null
    check (behavior_mode in ('dance_anchor', 'roaming')),
  animation_name text not null,
  roam_bounds jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
```

```sql
create table public.game_world_npc_offerings (
  npc_id text not null
    references public.game_world_npcs(id) on delete restrict,
  catalog_item_id uuid not null
    references public.game_catalog_items(id) on delete restrict,
  sort_order integer not null default 0,
  dialogue_version integer not null default 1,
  is_primary_source boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (npc_id, catalog_item_id)
);

create unique index game_world_offering_primary_source_unique
  on public.game_world_npc_offerings(catalog_item_id)
  where is_active and is_primary_source;
```

### 10.2 小孩解鎖與對話

```sql
create table public.child_world_scene_unlocks (
  family_id uuid not null,
  child_profile_id uuid not null,
  scene_id text not null
    references public.game_world_scenes(id) on delete restrict,
  unlock_rule_version integer not null,
  unlocked_at timestamptz not null default timezone('utc', now()),
  primary key (child_profile_id, scene_id),
  foreign key (family_id, child_profile_id)
    references public.child_profiles(family_id, id) on delete cascade
);
```

```sql
create table public.child_world_npc_dialogue_progress (
  family_id uuid not null,
  child_profile_id uuid not null,
  npc_id text not null
    references public.game_world_npcs(id) on delete restrict,
  dialogue_version integer not null default 1,
  first_talked_at timestamptz not null default timezone('utc', now()),
  last_talked_at timestamptz not null default timezone('utc', now()),
  primary key (child_profile_id, npc_id),
  foreign key (family_id, child_profile_id)
    references public.child_profiles(family_id, id) on delete cascade
);
```

### 10.3 Catalog 與購買來源

```sql
alter table public.game_catalog_items
  add column is_child_creation_selectable boolean not null default false,
  add column is_newly_obtainable boolean not null default true;

alter table public.game_item_purchases
  add column source_scene_id text
    references public.game_world_scenes(id) on delete restrict,
  add column source_npc_id text
    references public.game_world_npcs(id) on delete restrict,
  add column source_dialogue_version integer;

alter table public.child_inventory_items
  add column source_scene_id text
    references public.game_world_scenes(id) on delete restrict,
  add column source_npc_id text
    references public.game_world_npcs(id) on delete restrict,
  add column source_dialogue_version integer;
```

### 10.4 場景與相容性 seed

```sql
insert into public.game_world_scenes
  (id, name, sort_order, required_completed_count,
   required_general_count, unlock_rule_version)
values
  ('sunrise-village', '晨光村', 1, 0, 0, 1),
  ('forest-valley', '森語谷', 2, 5, 0, 1),
  ('cloud-workshop', '雲工房', 3, 12, 2, 1),
  ('tideglow-archipelago', '潮光群島', 4, 20, 5, 1),
  ('star-sand-wasteland', '星砂荒原', 5, 30, 10, 1)
on conflict (id) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  required_completed_count = excluded.required_completed_count,
  required_general_count = excluded.required_general_count,
  unlock_rule_version = excluded.unlock_rule_version,
  updated_at = timezone('utc', now());
```

```sql
update public.game_catalog_items
set is_child_creation_selectable =
  asset_key in (
    'character.arthur',
    'character.elina',
    'character.sia',
    'character.elio'
  )
where item_type = 'character';
```

```sql
update public.game_catalog_items
set is_newly_obtainable = false
where item_type = 'pet'
  and asset_key in (
    'pet.forest-guardian',
    'pet.starlight-sprout',
    'pet.chrono-rabbit',
    'pet.silf-owl',
    'pet.yaoguang-deer',
    'pet.murphy-bear',
    'pet.magellan-rabbit',
    'pet.buleifu-tiger',
    'pet.belilos-fox',
    'pet.baruku-mushroom',
    'pet.star-diver'
  );
```

這段不修改 `is_active`，也不刪除任何背包、角色或資產。

### 10.5 新建小孩的後端防線

新建小孩的限制由資料庫 trigger 保護。既有資料不會觸發 `before insert`，因此六位測試角色可繼續保留。

```sql
create function private.enforce_new_child_character()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1
    from public.game_catalog_items item
    where item.item_type = 'character'
      and item.asset_key = new.character_id
      and item.is_active
      and item.is_child_creation_selectable
  ) then
    raise exception 'child character is not selectable'
      using errcode = '22023';
  end if;
  return new;
end;
$$;
```

```sql
drop trigger if exists enforce_new_child_character
  on public.child_profiles;

create trigger enforce_new_child_character
before insert on public.child_profiles
for each row execute function private.enforce_new_child_character();
```

正式 migration 應先 `drop function if exists private.enforce_new_child_character()` 再建立 function。不要改寫既有的身份不可變 trigger。

### 10.6 人物與巡遊寵物 seed

人物位置是第一版錨點。正式實作要依場景碰撞結果調整座標。

```sql
insert into public.game_world_npcs
  (id, scene_id, npc_type, name, asset_key,
   position_x, position_y, position_z,
   behavior_mode, animation_name)
values
  ('npc.gilt', 'sunrise-village', 'character_vendor',
   '吉爾特', 'character.gilt', 0, 0, -2, 'dance_anchor', 'Dance'),
  ('npc.moss', 'forest-valley', 'character_vendor',
   '莫斯', 'character.moss', -2, 0, -1, 'dance_anchor', 'Dance'),
  ('npc.lunalia', 'forest-valley', 'character_vendor',
   '露娜莉亞', 'character.lunalia', 2, 0, -1, 'dance_anchor', 'Dance'),
  ('npc.noah', 'cloud-workshop', 'character_vendor',
   '諾亞', 'character.noah', 0, 0, -2, 'dance_anchor', 'Dance'),
  ('npc.collette', 'tideglow-archipelago', 'character_vendor',
   '柯蕾特', 'character.collette', 0, 0, -2, 'dance_anchor', 'Dance'),
  ('npc.violette', 'star-sand-wasteland', 'character_vendor',
   '薇歐莉特', 'character.violette', 0, 0, -2, 'dance_anchor', 'Dance');
```

```sql
insert into public.game_world_npcs
  (id, scene_id, npc_type, name, asset_key, catalog_item_id,
   position_x, position_y, position_z,
   behavior_mode, animation_name, roam_bounds)
select
  map.npc_id, map.scene_id, 'roaming_pet', item.name,
  map.asset_key, item.id, map.x, 0, map.z,
  'roaming', 'Idle',
  jsonb_build_object(
    'minX', -6, 'maxX', 6, 'minZ', -4, 'maxZ', 4
  )
from (values
  ('npc.oum', 'sunrise-village', 'pet.oum', -3, 1),
  ('npc.arcadia', 'sunrise-village', 'pet.arcadia', 3, 1),
  ('npc.jasmine', 'forest-valley', 'pet.jasmine', -3, 1),
  ('npc.qifu-er', 'forest-valley', 'pet.qifu-er', 3, 1),
  ('npc.nibus', 'cloud-workshop', 'pet.nibus', -3, 1),
  ('npc.orian', 'cloud-workshop', 'pet.orian', 3, 1),
  ('npc.christo', 'tideglow-archipelago', 'pet.christo', 0, 1),
  ('npc.kaldo', 'star-sand-wasteland', 'pet.kaldo', -3, 1),
  ('npc.moko', 'star-sand-wasteland', 'pet.moko', 3, 1)
) as map(npc_id, scene_id, asset_key, x, z)
join public.game_catalog_items item
  on item.item_type = 'pet'
 and item.asset_key = map.asset_key;
```

### 10.7 完整主要 offering seed

以下 27 筆涵蓋九隻場景寵物與 18 件裝飾。`game_catalog_items` 的名稱欄位是 `name`，不是 `display_name`。

```sql
insert into public.game_world_npc_offerings
  (npc_id, catalog_item_id, sort_order, is_primary_source)
select map.npc_id, item.id, map.sort_order, true
from (values
  ('npc.gilt', 'pet.oum', 1),
  ('npc.gilt', 'pet.arcadia', 2),
  ('npc.gilt', 'decoration.bed', 3),
  ('npc.gilt', 'decoration.nightstand', 4),
  ('npc.gilt', 'decoration.sofa', 5),
  ('npc.gilt', 'decoration.pawprint-rug', 6),
  ('npc.moss', 'pet.jasmine', 1),
  ('npc.moss', 'pet.qifu-er', 2),
  ('npc.moss', 'decoration.stone-fire-pit', 3),
  ('npc.lunalia', 'decoration.fountain', 1),
  ('npc.lunalia', 'decoration.patchwork-rug', 2),
  ('npc.lunalia', 'decoration.wall', 3),
  ('npc.noah', 'pet.nibus', 1),
  ('npc.noah', 'pet.orian', 2),
  ('npc.noah', 'decoration.computer-desk', 3),
  ('npc.noah', 'decoration.study-desk', 4),
  ('npc.noah', 'decoration.study-chair', 5),
  ('npc.noah', 'decoration.gaming-chair', 6),
  ('npc.collette', 'pet.christo', 1),
  ('npc.collette', 'decoration.blue-rug', 2),
  ('npc.collette', 'decoration.lavender-pattern-rug', 3),
  ('npc.collette', 'decoration.floor-lamp', 4),
  ('npc.violette', 'pet.kaldo', 1),
  ('npc.violette', 'pet.moko', 2),
  ('npc.violette', 'decoration.bookcase', 3),
  ('npc.violette', 'decoration.curtain-wall', 4),
  ('npc.violette', 'decoration.royal-crest-rug', 5)
) as map(npc_id, asset_key, sort_order)
join public.game_catalog_items item
  on item.asset_key = map.asset_key;
```

### 10.8 寵物自有 offering

巡遊寵物只提供自己。`is_primary_source = false`，所以全域商店仍顯示主要人物 NPC。

```sql
insert into public.game_world_npc_offerings
  (npc_id, catalog_item_id, sort_order, is_primary_source)
select npc.id, npc.catalog_item_id, 1, false
from public.game_world_npcs npc
where npc.npc_type = 'roaming_pet'
  and npc.catalog_item_id is not null;
```

### 10.9 RLS 與權限

```sql
alter table public.game_world_scenes enable row level security;
alter table public.game_world_npcs enable row level security;
alter table public.game_world_npc_offerings enable row level security;
alter table public.child_world_scene_unlocks enable row level security;
alter table public.child_world_npc_dialogue_progress enable row level security;
```

全域內容表只允許 authenticated 讀取 active rows。小孩進度表沿用現有授權 helper：

```sql
using (
  private.is_family_parent(family_id)
  or private.is_child_owner(family_id, child_profile_id)
)
```

客戶端不可直接寫入解鎖、對話、購買、錢包或背包。只 grant 全域內容與本人進度的 `select`。寫入經過 `security definer` RPC，且 function 固定安全的 `search_path`。

### 10.10 RPC 契約

需要新增：

- `unlock_world_scene_if_eligible(target_scene_id, target_child_profile_id)`
- `complete_world_npc_dialogue(target_npc_id, target_child_profile_id)`

需要擴充：

- `purchase_game_item(..., target_source_npc_id text default null)`

解鎖 RPC 必須：

1. 使用現有授權 helper 解析小孩
2. 計算 `tasks.status = 'completed'` 的總數
3. 計算其中 `adventure_type = 'general'` 的數量
4. 驗證場景條件
5. 以 `on conflict do nothing` 寫入永久解鎖

對話 RPC 必須：

1. 驗證 NPC active
2. 驗證小孩已解鎖 NPC 所屬場景
3. 更新該小孩的對話進度
4. 只回傳 active 且 `is_newly_obtainable` 的 offering

購買 RPC 必須：

1. 驗證目前小孩有操作權限
2. 驗證場景已解鎖
3. 驗證對話已完成
4. 驗證 NPC 確實提供該商品
5. 驗證商品 active 且 `is_newly_obtainable`
6. 在同一交易中扣款、寫入 ledger、purchase 與 inventory
7. 保存實際場景、NPC 與對話版本
8. 保留現有 idempotency 行為

既有舊寵物的裝備、跟隨與世界放置 RPC 不得檢查 `is_newly_obtainable`。該欄位只限制新的取得行為。

## 11. 舊寵物保留策略

### 11.1 停止新取得的寵物

| 名稱 | Catalog key |
|---|---|
| 森林守護者 | `pet.forest-guardian`，並稽核 legacy `pet.starlight-sprout` |
| 克羅諾 | `pet.chrono-rabbit` |
| 希爾芙 | `pet.silf-owl` |
| 瑤光 | `pet.yaoguang-deer` |
| 墨菲熊 | `pet.murphy-bear` |
| 麥哲倫 | `pet.magellan-rabbit` |
| 布雷夫虎 | `pet.buleifu-tiger` |
| 貝里洛斯 | `pet.belilos-fox` |
| 巴魯菇 | `pet.baruku-mushroom` |
| 星辰潛者 | `pet.star-diver` |

### 11.2 必須保留的內容

- `game_catalog_items` rows
- `game_item_purchases`
- `child_inventory_items`
- `child_game_loadouts`
- `child_world_entities`
- GLB、縮圖與動畫 metadata
- runtime 中支援這些寵物的必要邏輯
- 好友世界與預覽器相容邏輯
- 共用測試與舊寵物相容測試
- 所有已套用的歷史 migration

這批寵物不加入五座新場景，也不出現在新商店。既有測試帳號仍可裝備、跟隨、巡遊與放置。

### 11.3 禁止的清理操作

- 不刪除寵物資產
- 不刪除 catalog rows
- 不刪除購買或背包紀錄
- 不將 `is_active` 設為 false
- 不改寫或刪除歷史 migration
- 不移除既有帳號仍會呼叫的 runtime 分支
- 不因停止新取得而刪除相容性測試

## 12. 程式實作邊界

目前專案需要調整的主要位置：

- 場景 ID：[world-location.ts](/Users/studio.vv/Desktop/HabitHero/src/features/world/world-location.ts)
- 建立小孩 UI：[ParentSettingsChildrenSection.tsx](/Users/studio.vv/Desktop/HabitHero/src/components/parent-dashboard/ParentSettingsChildrenSection.tsx)
- 完整角色目錄：[world-character-catalog.ts](/Users/studio.vv/Desktop/HabitHero/src/features/characters/world-character-catalog.ts)
- 場景切換：[ChildDashboard.tsx](/Users/studio.vv/Desktop/HabitHero/src/components/ChildDashboard.tsx)
- 商店與背包：[ChildGamePanel.tsx](/Users/studio.vv/Desktop/HabitHero/src/features/world/components/ChildGamePanel.tsx)
- 場景輸入：[world-scene-input.ts](/Users/studio.vv/Desktop/HabitHero/src/features/world/world-scene-input.ts)
- 世界互動：[world-interaction.ts](/Users/studio.vv/Desktop/HabitHero/src/features/world/world-interaction.ts)
- 經濟資料模型：[contracts.ts](/Users/studio.vv/Desktop/HabitHero/src/features/world/contracts.ts)
- 資料存取：[data-access.ts](/Users/studio.vv/Desktop/HabitHero/src/lib/data-access.ts)
- 現有經濟 schema：[20260810010550_game_economy_schema.sql](/Users/studio.vv/Desktop/HabitHero/supabase/migrations/20260810010550_game_economy_schema.sql)
- 現有購買 RPC：[20260810010603_game_economy_rpcs.sql](/Users/studio.vv/Desktop/HabitHero/supabase/migrations/20260810010603_game_economy_rpcs.sql)

建議新增：

- `world-scene-content.ts`
- `world-scene-unlocks.ts`
- `world-npc-dialogue.ts`
- `world-npc-shop.ts`
- `world-npc-runtime.ts`

公共場景 NPC 是 ambient content，不是某個小孩擁有的 `child_world_entities`。購買後的物品才進入小孩背包與自己的世界。

## 13. 分階段實作

### Phase 0：建立測試與資料稽核

- 列出所有角色、寵物與裝飾 asset key
- 確認 27 件場景商品都有且只有一個主要人物來源
- 確認十隻舊寵物的既有背包、loadout 與 world entity
- 為新建角色限制、解鎖規則與舊寵物相容性建立失敗測試

### Phase 1：新增 schema 與權限

- 建立場景、NPC、offering、解鎖與對話表
- 新增兩個 catalog 相容欄位
- 新增購買與背包來源快照
- 新增 RLS、trigger 與 RPC
- 不改寫任何既有 migration

### Phase 2：建立內容 seed

- 寫入五座場景
- 寫入六位人物 NPC
- 寫入九隻巡遊寵物 NPC
- 寫入 27 件主要人物 offering
- 寫入九筆寵物自有 offering
- 將十隻舊寵物設為不可新取得

### Phase 3：前端與場景 runtime

- 建立小孩選單只顯示四位
- 場景入口顯示解鎖進度
- 人物 NPC 持續播放跳舞 loop
- 寵物在正確場景巡遊
- 對話顯示正確 offering
- 商店與背包顯示取得位置

### Phase 4：相容性與完整驗收

- 既有六位角色帳號可正常登入及使用
- 既有十隻舊寵物可裝備、跟隨、巡遊與放置
- 新帳號不能選六位 NPC 角色
- 新帳號不能購買或獲得十隻舊寵物
- 所有五座場景通過手機與桌面互動驗收

## 14. 測試與驗收

### 14.1 角色

- 新建小孩只顯示四位角色
- 直接呼叫後端也不能用六位 NPC 建立新小孩
- migration 前已存在的六位角色帳號保持原值
- 完整 `WORLD_CHARACTER_CATALOG` 仍包含十位人物
- NPC 與好友世界仍能解析六位人物資產

### 14.2 場景解鎖

- 晨光村預設解鎖
- 只有 `status = 'completed'` 計入
- `pending`、`todo`、`revision_requested` 不計入
- 一般冒險數只計算 `adventure_type = 'general'`
- 未達條件無法直接呼叫 RPC 解鎖
- 已解鎖場景不會重新鎖定
- 家庭內兩個小孩的進度互不影響

### 14.3 NPC、對話與購買

- 六位人物在正確場景持續跳舞
- 對話與商店開啟時舞蹈不中斷
- 九隻寵物在正確範圍巡遊
- 未解鎖場景無法完成對話或購買
- 未完成對話無法購買場景商品
- offering 以資料庫為準
- 重複 purchase idempotency key 不重複扣款
- 扣款、ledger、purchase 與 inventory 保持交易一致
- 背包顯示實際場景與 NPC

### 14.4 舊內容相容性

- `is_newly_obtainable = false` 不影響既有 inventory
- 舊寵物不出現在新商店
- 已擁有舊寵物仍可裝備與顯示
- 舊寵物 GLB、縮圖、ground、scale、shadow、label 與動畫仍正常
- 既有非四位角色仍可登入、顯示與進入世界

### 14.5 安全與資料庫

- Row Level Security（RLS）阻止家庭外帳號讀取小孩進度
- 客戶端無法直接寫入解鎖、對話、錢包、購買或背包
- RPC 不能接受未授權的 `child_profile_id`
- RPC 不能接受不屬於場景的 NPC 或商品
- migration 可在本地空資料庫套用
- migration 可在含測試帳號的本地資料庫套用
- migration history 無 drift 後才執行 linked dry-run
- 不使用未審核的 `db push --include-all`

### 14.6 視覺與操作

- 互動按鈕觸控範圍至少 44 px
- 姓名標籤不被主要場景物件遮擋
- 人物不穿地、不漂浮
- 寵物不穿越牆面、商店錨點或傳送點
- 載入與錯誤狀態不會留下空白場景
- reduced motion 模式降低非必要動作，但保留互動

## 15. 驗證指令

實作完成後依風險執行：

```bash
npm test
npm run lint
npm run quality:structure
npm run build
npm run security:check
```

Supabase 依專案部署規則執行：

```bash
npx supabase migration list
npx supabase db push --linked --dry-run
```

不能只因 dry-run 需要舊 migration 就直接加入 `--include-all`。

## 16. 完成條件

- 新建小孩只可選四位人物
- 既有非四位角色帳號完全保留
- 五座場景依每個小孩的已核准冒險解鎖
- 六位人物 NPC 在正確場景持續跳舞
- 九隻寵物在正確場景巡遊並可對話
- 18 件裝飾平均配置完成
- 對話後才能用冒險卷購買
- 商店與背包顯示購買場景及 NPC
- 購買只寫入目前小孩
- 十隻舊寵物停止新取得
- 已擁有的舊寵物保持可用
- 沒有刪除舊寵物資產、程式支援、資料或歷史 migration
- 沒有建立訂閱、IAP 或付款流程

## 17. 本輪文件修改範圍

本輪只修正這份計畫。沒有修改 React、TypeScript、GLB、圖片、測試、Supabase migration 或遠端資料庫。
