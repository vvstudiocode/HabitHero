# HabitHero 3D 世界、任務捲、背包與佈置模式整合計畫

**狀態：** 第一波分析完成，依使用者指示暫停；尚未開始功能實作

**日期：** 2026-08-09

**內容類型：** 技術與產品規格

**閱讀對象：** 接手規劃、實作、測試或審查的 AI 與開發者

**交付目標：** 讓接手者能依階段整合 3D 世界與遊戲經濟，且不破壞現有孩子介面

**範圍：** 孩子模式、3D terrain 場景、動態虛擬搖桿、任務捲、遊戲商店、背包、角色、寵物、裝飾與自由佈置
**不在本文件範圍：** 家長端全面改版、抽卡、付費貨幣、排行榜、寵物養成數值

---

## 0. 目前交接狀態

本輪已完成五個領域的第一波只讀分析與本機基線驗證。使用者在 2026-08-09 指示暫停，改由其他 AI 接手。接手者不得把本文件的設計內容誤認為已完成的程式功能。

### 0.1 已完成

- 建立並更新本計畫
- 取得 3D 場景、手機控制、孩子 UI、測試與風險的完整代理報告
- 取得 SQL 代理的核心風險回報；使用者要求暫停後已中止該代理
- 執行 `npm run lint`，結果通過
- 執行 `npm test`，結果為 210/210 通過
- 核對 Supabase CLI，當時由 `npx` 取得 `2.113.0`
- 核對 Supabase 官方 RLS、資料庫函式與 migration 文件
- 確認工作區在本輪開始前已存在未提交變更與未追蹤原型資產

### 0.2 尚未完成

- 未建立任何新 Supabase migration、資料表、RPC、RLS policy 或 SQL 測試
- 未安裝 `three`，未把 Prototype 拆成 React／Three.js 模組
- 未建立正式 input state machine、動態搖桿或雙指相機控制
- 未修改孩子面板、統計、選單、背包、商店或設定
- 未複製、壓縮或部署 3D 資產
- 未啟動開發伺服器或本機 Supabase stack
- 未執行遠端 Supabase mutation、`db push`、Git push 或部署

### 0.3 本輪實際檔案變更

本輪只修改本計畫：

- `plans/14-terrain-world-economy/PLAN.md`

工作區原本已有以下使用者變更，接手者必須保留並重新檢查，不可覆蓋：

- `src/lib/adventure-store-actions.ts`
- `src/lib/push-notifications.ts`
- `src/store.tsx`
- `supabase/functions/notify-task-created/index.ts`
- `tests/adventure-data-offline-queue.test.ts`
- `tests/push-notification-contract.test.ts`
- `terrain-prototype/` 與多個未追蹤圖片／測試檔

### 0.4 已指定的代理模型

若使用者仍希望沿用相同分工：

- 第一波只讀分析：GPT-5.6 Sol，`ultra`
- 第二波分區實作：GPT-5.6 Terra，`ultra`
- 第三波獨立審核：GPT-5.6 Sol，`medium`

第二波尚未啟動。第三波也尚未啟動。

## 1. 文件目的

本文件是未來 AI 或開發者進行 3D 世界整合時的產品與技術交接文件。實作者不得只把 `terrain-prototype/index.html` 用 iframe 放進孩子模式，也不得把任務捲套用到現有 `tickets` 或 `points` 欄位。

實作前仍須閱讀：

- 根目錄 `AGENTS.md`
- 根目錄 `CSS_RULES.md`
- `plans/13-child-adventure-board/PLAN.md`
- `docs/child-profile-and-dashboard-rules.md`

本計畫不建立 `.specify/`。GitHub Spec Kit CLI 已確認可用；只有使用者明確同意後才能初始化 Spec Kit 專案檔案。

---

## 2. 已確認的產品決策

### 2.1 孩子模式與現有介面

- `terrain-prototype` 的第三人稱 3D 世界要整合到孩子模式。
- 現有孩子面板的視覺語言、任務卡、功能面板與操作位置原則上不改版。
- 3D 世界是孩子模式的全畫面背景層；現有 React UI 疊在場景上方。
- 家長模式維持目前的管理介面，不在第一階段改成 3D 世界。
- 每個孩子擁有獨立的任務捲、庫存、裝備、寵物狀態與場景擺設。

### 2.2 任務捲

- 任務捲是獨立遊戲貨幣，不是現有點數，也不是現有兌換紀錄 `tickets`。
- 任務只有在家長核准完成後才增加任務捲。
- 每一個核准完成的任務固定增加 `1` 張任務捲。
- 每日冒險、一般冒險、孩子提出後由家長核准的冒險、核准點數為 `0` 的任務與批次核准任務全部適用。
- 同一個任務最多發放一次任務捲。
- 任務捲用於購買角色、寵物與裝飾品。
- 現有點數仍保留，繼續服務現實獎勵兌換；孩子面板同時顯示點數與任務捲。

### 2.3 角色、寵物與裝飾

- Prototype 目前使用的 `anime-maiden.glb` 是第一位免費初始 3D 角色。
- 現有 `child_profiles.character_id` 保留為建立孩子時選定的既有／2D 身分角色，不改成商品庫存欄位。
- 新增獨立的「已擁有角色」與「目前裝備角色」資料。
- 每個孩子最多裝備一名目前角色。
- 每個孩子最多指定一隻寵物跟隨角色。
- 其他已擁有且被放入世界的寵物可以待機或在場景中閒逛，同時最多三隻。
- 角色與寵物不可重複購買。
- 裝飾品可重複購買，不設定商品數量上限。
- 裝飾品可以進入佈置模式，自由調整位置、旋轉與大小。
- 裝飾品不可互相重疊，且會形成角色與寵物必須繞開的碰撞物。

### 2.4 觸控移動

- 手機／平板在 3D 場景的任何空白位置按下，都可從按下位置叫出動態虛擬搖桿。
- 搖桿不限制在左半部。
- 單指控制動態搖桿；雙指一起拖曳控制視角；雙指距離變化控制縮放。
- 放開手指後搖桿淡出。
- 「任何地方」不包含按鈕、任務卡、面板、輸入欄位或其他可互動 UI；這些區域必須優先執行原本功能，不能同時讓角色移動。
- 電腦保留 WASD／方向鍵移動。

---

## 3. 孩子模式資訊架構

### 3.1 左上統計

現有統計不得刪除。孩子模式顯示：

```text
加入天數    點數    任務捲
12 天       240     18
```

實作要求：

- 任務捲放在點數旁邊，包含任務捲圖示與數字。
- 不用 emoji 當圖示；使用專案一致的 SVG／Lucide 或正式遊戲資產。
- `DashboardCharacterHero` 目前只有兩個固定 stat props；實作時應改為可組合的 `stats` 陣列或等價資料結構，不要繼續新增 `thirdStat*`、`fourthStat*` props。
- 手機寬度不得水平溢出；數字位數增加時不得造成介面跳動。

### 3.2 右上背包主按鈕

保留現有右上背包圖示按鈕、尺寸、位置與展開動畫。點擊後的功能順序調整為：

1. 冒險日記
2. 背包
3. 商店
4. 獎勵
5. 成長
6. 設定

其中：

- `背包` 開啟庫存面板。
- `商店` 開啟遊戲商品面板。
- `設定` 內包含通知設定、切換視角與登出。
- `切換視角` 與 `登出` 不再直接出現在背包展開的第一層選單。
- 現有底部分頁與功能內容先保持不變；新增背包與商店時不得順便重做整套孩子導覽。

### 3.3 背包面板

背包面板至少有三個明確按鈕／分頁：

```text
角色｜寵物｜裝飾
```

每個項目至少顯示：

- 縮圖或 3D 預覽圖
- 名稱
- 已裝備／跟隨中／已放置狀態
- 可執行動作

各分類動作：

| 分類 | 動作 |
| --- | --- |
| 角色 | 預覽、裝備 |
| 寵物 | 預覽、設為跟隨、放入世界、收回背包 |
| 裝飾 | 預覽、進入佈置模式放置、收回背包 |

### 3.4 商店面板

商店使用任務捲定價，至少分為角色、寵物、裝飾三類。購買流程：

1. 選擇商品。
2. 顯示預覽、價格與目前任務捲餘額。
3. 孩子確認購買。
4. 後端交易同時驗證餘額、扣除任務捲、寫入帳本並加入庫存。
5. 成功後更新餘額與背包；失敗不得扣款或留下半套庫存。

第一版不加入抽卡、限時倒數、付費購買任務捲或隨機商品。

商品角色、寵物、裝飾與資產由開發者維護固定 catalog。正式商品資料由 production migration 建立；`seed.sql` 只放本機／測試資料。家長只能調整自己家庭看到的任務捲價格，不能新增、刪除、換模型或修改商品類型。沒有家庭價格覆寫時，使用 catalog 預設價格。

### 3.5 設定面板

設定面板至少包含：

- 通知設定
- 切換視角／切換孩子（維持現有家長密碼保護流程）
- 登出

切換視角與登出是帳號／家庭層級操作，不應混在遊戲背包庫存中。

---

## 4. 3D 場景整合架構

### 4.1 正式整合方式

不得直接把 Prototype iframe 進 React。正式結構應拆成：

```text
ChildDashboard
├─ TerrainWorldLayer（3D 場景與渲染）
├─ ChildAdventureBoard（既有）
├─ Dashboard HUD（既有視覺，擴充統計與選單）
├─ Feature Panels（冒險日記／背包／商店／獎勵／成長／設定）
└─ Toast／Modal／Loading／Error overlays
```

技術要求：

- 將 Three.js 納入專案依賴與 Vite bundle，不使用 runtime CDN import map。
- 3D 世界以 lazy loading 載入，避免拖慢登入與家長端首屏。
- React 管理產品狀態與面板；場景引擎管理每幀位置、動畫、相機與渲染。
- 不把每幀角色座標寫入 React state 或 Supabase。
- Scene mount／unmount、切換孩子、登出與 App 進入背景時，必須釋放 animation frame、事件監聽、texture、geometry、material、mixer 與 WebGL 資源。
- Prototype 已有的草地互動、樹木、花朵、角色 walk／idle、相機縮放與場景 loading 應先移植，再新增商品系統。

### 4.2 介面不改版的實作邊界

「介面不改動」定義為：

- 保留現有孩子模式的任務卡、右上主按鈕、面板樣式、主題色與互動方式。
- 允許為任務捲、背包、商店、設定內容新增必要項目。
- 允許把現有靜態圖片／影片場景層換成即時 3D 場景。
- 不允許趁整合時重排任務板、重做家長端或替換全域設計系統。

開始 CSS 變更前必須依 `CSS_RULES.md` 找到 selector owner：幾何與 menu layout 由 `src/styles/character.css` 管理，主題表面由 `src/styles/neutral-theme.css` 管理，面板與 drawer 由 overlay／modal owner 管理。禁止在檔案尾端追加 override CSS。

---

## 5. 輸入與虛擬搖桿規格

### 5.1 動態搖桿

在 coarse pointer 裝置上：

1. `pointerdown` 發生在 3D canvas 的空白位置。
2. 該位置成為搖桿中心。
3. 手指移動向量決定角色移動方向與速度。
4. 搖桿圓心可有最大位移半徑，超過後只保留方向與最大速度。
5. `pointerup`／`pointercancel`／視窗失焦後立即停止移動。
6. 搖桿在按下時顯示約 60–70% opacity，放開後於 200–300ms 內淡出。
7. 角色行走動畫與速度以向量強度切換；dead zone 內維持 idle。

需使用 Pointer Events 與 pointer capture，並處理：

- 手指滑出 canvas
- 系統中斷手勢
- 第二根手指加入
- App 進入背景
- 面板打開時強制清除移動狀態
- 旋轉裝置與 safe area

### 5.2 UI 命中優先順序

輸入優先順序固定為：

```text
Modal／確認視窗
> Feature panel／按鈕／任務卡
> 佈置模式控制柄
> 3D 場景搖桿與相機手勢
```

互動 UI 必須阻止事件穿透到 canvas。不能以全畫面透明 canvas 捕捉所有 pointer event，否則孩子會無法可靠點擊背包與任務。

### 5.3 已確認的相機手勢

- 第一根手指按在場景空白處時控制動態搖桿。
- 第二根手指加入後，系統結束單指搖桿輸入並進入雙指相機手勢。
- 兩指以相同方向拖曳時調整 yaw 與 pitch。
- 兩指距離變化時調整相機距離。
- 任一手指離開後結束本次相機手勢；不得直接把剩餘手指轉成搖桿，必須全部放開後重新按下，避免角色突然移動。
- 桌面維持滑鼠拖曳相機與鍵盤移動。

---

## 6. 資料模型

以下名稱是建議語意，實際 migration 可依現有命名慣例調整。所有孩子資料必須以 `child_profile_id` 隔離並套用 Row Level Security (RLS)。所有跨表交易使用資料庫 Remote Procedure Call (RPC)。

### 6.1 商品目錄 `game_catalog_items`

建議欄位：

```text
id
item_type               character | pet | decoration
name
description
scroll_price
asset_key
thumbnail_url
is_active
is_starter
is_stackable
sort_order
metadata jsonb
created_at
updated_at
```

`asset_key` 是穩定資產 ID；不得直接以易變 URL 當商品主鍵。下架商品仍需保留，讓已購買孩子繼續使用。

### 6.2 家庭商品價格 `family_game_item_prices`

```text
id
family_id
catalog_item_id
scroll_price check >= 1
updated_by
created_at
updated_at
unique (family_id, catalog_item_id)
```

只有家庭家長可以新增、修改或刪除價格覆寫。孩子只能讀取自己家庭的有效價格。有效價格依序採用家庭覆寫與 catalog 預設值；孩子端不得提交或覆寫實際成交價格。

### 6.3 任務捲錢包 `child_game_wallets`

```text
child_profile_id unique
scroll_balance check >= 0
updated_at
```

餘額只可由受信任的 RPC／資料庫交易修改，孩子端不得直接 update。

### 6.4 任務捲帳本 `game_currency_ledger`

```text
id
family_id
child_profile_id
currency                 quest_scroll
entry_type               task_approved | purchase | refund | admin_adjustment | starter_grant
amount_delta
source_task_id nullable
source_purchase_id nullable
note nullable
created_at
```

必要約束：

- 每個 `source_task_id` 對任務捲獎勵只能有一筆正向紀錄。
- 金額不得為 0。
- 發放、扣款與餘額更新必須在同一交易。
- 前端顯示餘額，但帳本與 RPC 才是真實來源。

帳本不能單獨代表購買收據。購買交易必須先建立 `game_item_purchases`，再以 `source_purchase_id` 連結扣款帳本。

### 6.5 孩子庫存 `child_inventory_items`

```text
id
family_id
child_profile_id
catalog_item_id
quantity
acquired_via             starter | purchase | grant
acquired_at
```

規則：

- 角色與寵物不可重複購買，對 child + item 建唯一約束或等價的條件唯一索引。
- 裝飾品可重複購買，`quantity` 不設定產品上限；資料型別與資料庫整數上限仍然適用。
- 庫存刪除不代表商品目錄刪除。

### 6.6 裝備狀態 `child_game_loadouts`

```text
child_profile_id unique
equipped_character_inventory_id
following_pet_inventory_id nullable
updated_at
```

RPC 必須驗證裝備項目確實屬於該孩子，且類型正確。`equipped_character_inventory_id` 不得指向 `child_profiles.character_id`。

### 6.7 世界實體 `child_world_entities`

```text
id
family_id
child_profile_id
inventory_item_id
entity_kind               pet | decoration
world_layout_version
position_x
position_y
position_z
rotation_x
rotation_y
rotation_z
scale
behavior_mode             static | idle | wander
roaming_slot nullable     1 | 2 | 3
is_active
updated_at
```

規則：

- 裝飾儲存使用者最後確認的 transform，不儲存每一幀拖曳資料。
- 寵物只儲存是否放入世界與 behavior mode；閒逛的即時座標預設不需要每幀同步。
- 跟隨寵物不佔 roaming slot；閒逛寵物只能使用 `1`、`2`、`3` 三個位置，並以唯一約束避免同一孩子超過三隻。
- 所有座標、旋轉與比例都要由後端限制合理範圍，不能信任孩子端數值。
- 裝飾碰撞 footprint 由 catalog metadata 定義；保存前同時在前端預覽與後端 RPC 驗證不可重疊。
- `world_layout_version` 用於未來 terrain 尺寸或地圖結構改變時遷移舊擺設。

### 6.8 核准更正紀錄 `task_approval_corrections`

```text
id
family_id
child_profile_id
task_id
corrected_by
points_reversed
scroll_reversed
reward_retained_reason nullable
created_at
```

此表只保存家長撤銷核准的稽核結果。紀錄不可由孩子新增、修改或刪除，也不可用刪除原始 ledger 的方式取代。

### 6.9 購買收據 `game_item_purchases`

```text
id
family_id
child_profile_id
catalog_item_id
idempotency_key
quantity
unit_price
total_price
catalog_name_snapshot
catalog_type_snapshot
created_at
```

必要約束：

- `idempotency_key` 由前端每次確認購買時產生 UUID，同一孩子不得重複使用
- RPC 重試同一 key 時回傳原購買結果，不得再次扣款或增加庫存
- `unit_price` 與 `total_price` 由資料庫依有效價格計算，不能採用前端價格
- 正式可購買商品價格至少為一張任務捲；免費初始角色走 starter backfill，不走購買 RPC
- 收據不可由孩子直接新增、修改或刪除

### 6.10 世界版本 `child_world_states`

```text
child_profile_id unique
revision bigint check >= 0
updated_at
```

所有放置、移動、收回與全部收回 RPC 都必須鎖定此列，接收 `expected_revision`，成功後將 revision 加一。舊 revision 必須回傳明確衝突，不能採 last-write-wins。

第一版碰撞 footprint 固定使用 XZ 平面的圓形半徑：

- catalog 保存 `collision_radius`
- 實際半徑為 `collision_radius * scale`
- 兩圓距離小於半徑和加 epsilon 時視為重疊
- epsilon、世界邊界、角色出生點與中央樹禁放區由前後端共用常數定義
- 後端 RPC 使用孩子世界列鎖或 transaction-level advisory lock，避免兩台裝置同時放置而穿過重疊檢查

---

## 7. 核心後端交易

### 7.1 家長核准任務

現有 `review_adventure_completion`／任務核准交易需要同時完成：

1. 鎖定任務列並確認狀態是 `pending`。
2. 確認目前使用者是該家庭家長。
3. 依既有規則發放點數。
4. 寫入一筆 `task_approved +1` 任務捲帳本。
5. 將孩子任務捲餘額加一。
6. 將任務標記為 `completed`。
7. 整個流程一次 commit；任一步失敗則全部 rollback。

批次核准每日任務也要走相同帳務語意。不能只在單筆核准加任務捲、漏掉 batch RPC。

### 7.2 購買商品

建議建立單一 `purchase_game_item(target_item_id, quantity)` RPC：

1. 由 auth session 解析孩子身分；家長孩子預覽模式則需明確傳入並驗證 child ID。
2. 鎖定孩子錢包與商品。
3. 從資料庫計算 catalog 預設價格或家庭價格覆寫，驗證商品上架、類型與購買數量。
4. 驗證不可重複商品尚未擁有。
5. 驗證餘額足夠。
6. 扣除餘額。
7. 寫入負向帳本與 purchase record。
8. 新增或增加庫存。
9. 返回最新餘額與庫存項目。

不得由前端分成「先扣款、再 insert inventory」兩個請求。

家長價格調整使用獨立的 `set_family_game_item_price` RPC。RPC 只接受商品 ID 與正整數價格，家庭 ID 必須從目前家長可管理的家庭解析，不能信任前端傳入的家庭歸屬。Starter 商品不可建立家庭價格覆寫。

### 7.3 裝備、跟隨與放置

至少需要受信任操作：

- `equip_game_character`
- `set_following_pet`
- `place_world_entity`
- `update_world_entity_transform`
- `remove_world_entity`

更新 transform 可以節流，但關閉佈置模式前必須確認保存結果；保存失敗時保留本地畫面並提供重試或復原，不可靜默遺失。

### 7.4 誤核准的一鍵撤銷

家長核准成功後顯示結果訊息：

```text
已核准：增加 20 點與 1 張任務捲                    撤銷
```

`撤銷` 按鈕至少保留 30 秒；完成任務詳情也保留「更正核准」入口。兩個入口都呼叫同一個 `revoke_task_approval` RPC，家長只需確認一次。

RPC 規則：

1. 驗證操作者是家庭家長，鎖定任務、點數餘額、任務捲錢包與兩種帳本。
2. 將任務從 `completed` 還原為核准前的 `pending`，讓家長重新審核。
3. 點數與任務捲分別判斷；餘額足夠的貨幣寫入反向帳並扣回本次獎勵。
4. 任一貨幣餘額不足時，不允許負數；仍撤銷任務核准，只保留該貨幣已使用的部分，並在 `task_approval_corrections` 記錄兩種貨幣的實際追回結果。
5. 被更正的任務再次核准時不得重複發放點數或任務捲；原始 grant ID 與 correction 紀錄負責防重複。
6. UI 明確顯示結果：「已撤銷並收回獎勵」或「已撤銷；孩子已使用獎勵，因此不追回，也不會再次發放」。

此設計讓家長只操作一個按鈕，也不會因孩子已花費而產生負餘額或刪除帳本歷史。

---

## 8. SQL migration、RLS 與 RPC 計畫

本功能必須新增正式 Supabase SQL migration。每個 migration 都先使用 CLI 建立，例如 `supabase migration new game_catalog_and_family_prices`。不得手動猜 timestamp 檔名，也不得直接修改 Production 後才補 migration。

### 8.1 建議 migration 拆分順序

1. `game_catalog_and_family_prices`
   - 建立 `game_catalog_items`
   - 建立 `family_game_item_prices`
   - 建立有效價格查詢所需索引
2. `child_game_wallet_ledger_and_purchases`
   - 建立 `child_game_wallets`
   - 建立 `game_currency_ledger`
   - 建立 `game_item_purchases`
   - 建立任務獎勵防重複條件唯一索引
3. `child_inventory_and_loadout`
   - 建立 `child_inventory_items`
   - 建立 `child_game_loadouts`
   - 建立角色／寵物不可重複購買約束
4. `child_world_entities`
   - 建立 `child_world_entities`
   - 建立 `child_world_states`
   - 建立每個孩子 roaming slot `1` 至 `3` 的條件唯一索引
   - 建立 child、active、entity kind 查詢索引
5. `task_approval_corrections`
   - 建立更正稽核表與 task 查詢索引
6. `game_economy_rpcs`
   - 更新單筆與批次核准 RPC
   - 建立購買、價格、裝備、寵物、場景、撤銷核准 RPC
7. `starter_character_backfill`
   - 新增 starter anime maiden catalog row
   - 為所有既有孩子建立錢包、starter inventory 與 loadout
   - 加入新孩子建立時的相同初始化流程

拆分 migration 時，每一步都要能在空資料庫依序重播。Backfill 使用 `insert ... on conflict do nothing` 或等價寫法，確保重跑不會重複發放。

### 8.2 SQL 約束與索引

至少建立：

- 所有餘額、價格、quantity 與 scale 的 `check` 約束
- `game_currency_ledger` 對 `source_task_id` 正向任務獎勵的條件唯一索引
- `family_game_item_prices (family_id, catalog_item_id)` 唯一索引
- 角色／寵物 child + catalog item 不可重複的條件唯一索引
- `child_game_wallets.child_profile_id` 與 `child_game_loadouts.child_profile_id` 唯一約束
- `child_world_entities (child_profile_id, roaming_slot)` 在 active wander pet 上的條件唯一索引
- 所有 child、family、catalog、inventory、task 外鍵
- 孩子刪除時遊戲資料的明確 cascade；catalog 下架或刪除不得連帶刪除既有庫存
- `updated_at` 維護與多裝置衝突需要的 revision／時間欄位

裝飾品數量不設產品上限，但 SQL 仍要求 `quantity > 0`。角色與寵物由條件唯一索引限制為一份。

### 8.3 Row Level Security

所有 `public` 新表都必須啟用 Row Level Security (RLS)，並使用 `to authenticated` 搭配家庭／孩子歸屬條件。不能只寫 `to authenticated`，也不能用可由使用者修改的 user metadata 判斷權限。

權限矩陣：

| 資料 | 孩子 | 家長 |
| --- | --- | --- |
| Catalog | 讀取上架與已擁有商品 | 讀取全部可定價商品 |
| 家庭價格 | 讀取自己家庭有效價格 | 讀取與修改自己家庭覆寫 |
| 自己的錢包／帳本 | 唯讀 | 讀取家庭孩子資料 |
| 自己的庫存／loadout／世界 | 讀取；寫入只經受信任 RPC | 讀取家庭孩子資料；管理操作經 RPC |
| 核准更正 | 不可新增、修改、刪除 | 經 RPC 新增；唯讀稽核 |

直接 table update 錢包、帳本與購買庫存一律拒絕。需要寫入的操作全部由具權限檢查的 RPC 完成。

若專案的 Data API 設定不會自動暴露新表，migration 還要加入最小必要 `grant`。Grant 只決定角色能否存取 Data API，不能取代 RLS；任何授予 `authenticated` 的表仍必須有正確 policy。

### 8.4 RPC 安全

若 RPC 必須使用 `security definer` 完成跨表交易，必須：

- 放在非 exposed schema，例如現有 `private` schema；只在 `public` 暴露最小 wrapper，或採現有專案安全模式
- 固定 `search_path = pg_catalog, public, private`
- 在函式內檢查 `(select auth.uid())`、家庭角色與 child ownership
- `revoke execute ... from public, anon`
- 只 `grant execute` 給實際需要的 `authenticated` role
- 不接受可由 session 推導的 family ID、成交價格、目前餘額或 item type 作為可信輸入
- 使用 row lock 與唯一約束處理同時核准、重試、雙裝置購買

需要的 RPC 清單：

```text
review_adventure_completion              修改既有，核准時同交易發任務捲
batch_review_daily_adventures             修改既有，每個首次完成任務各發一張
purchase_game_item                        原子扣款與加入庫存
set_family_game_item_price                家長調整家庭價格
reset_family_game_item_price              恢復 catalog 預設價格
equip_game_character                      裝備已擁有角色
set_following_pet                         設定最多一隻跟隨寵物
set_roaming_pets                          設定最多三隻閒逛寵物
place_world_entity                        放置裝飾或寵物
update_world_entity_transform             驗證邊界、比例、禁放區與重疊
remove_world_entity                       收回背包
collect_all_world_decorations             全部收回背包
revoke_task_approval                      一鍵撤銷誤核准
```

### 8.5 商品價格 SQL 規則

- 開發者以 production migration 管理固定 catalog 與預設價格；seed 只供本機／測試
- 家長只寫入 `family_game_item_prices`
- 購買 RPC 在資料庫內計算有效價格，不能採用前端送來的數字
- 家長刪除家庭覆寫後立即回到 catalog 預設價格
- 正式可購買商品價格必須是正整數；starter 項目可標記為免費，但只能由 backfill／初始化交易發放
- 價格變更不影響過去 purchase ledger；帳本保存實際成交價格

### 8.6 SQL 驗證流程

每次 schema 實作後至少執行：

```bash
supabase db reset
supabase migration list --local
supabase db advisors
npm run lint
npm test
npm run security:check
git diff --check
```

若目前 CLI 不支援 `supabase db advisors`，改用 Supabase advisor 工具。另需建立 SQL／整合測試驗證：

- anon 無法讀取遊戲私有資料或執行 RPC
- 孩子只能讀取自己的 wallet、inventory、loadout、world entities
- 家長只能管理自己家庭
- RPC 對未授權 child ID 回傳拒絕，不是空成功
- 同一任務並行核准只發一張
- 同一商品並行購買不會超扣或重複建立角色／寵物
- 家庭價格覆寫只影響該家庭
- migration 從空資料庫可完整重播
- starter backfill 可重跑且每個孩子只有一份角色
- 刪除孩子會清理其遊戲資料，不影響其他孩子或 catalog

正式推送前先執行 `supabase db push --dry-run`，檢查 migration 範圍；未經使用者明確批准不得推送遠端資料庫。

---

## 9. 初始角色與既有孩子遷移

### 9.1 初始商品

- 建立商品 `character.anime-maiden`，預設價格為 `0`，`is_starter = true`；它不可經購買 RPC 取得，只能由 starter 初始化交易發放。
- 新孩子建立時自動取得一筆 starter inventory，並設為 equipped character。
- 既有每位孩子在 migration／backfill 後也取得同一項目並裝備。
- Backfill 必須可重跑且不重複建立庫存。

### 9.2 舊角色欄位

- 不修改既有 `child_profiles.character_id` 的身分語意。
- 現有 2D Dashboard 圖片與建立孩子流程在第一階段繼續可用。
- 3D 場景讀取 `child_game_loadouts.equipped_character_inventory_id`。
- 若 loadout 缺失或資產載入失敗，fallback 到 starter character，不得顯示空白世界。

### 9.3 資產授權

`anime-maiden.glb` 的現有授權允許用於商業／非商業遊戲，但禁止重新販售、重新包裝、以原始或修改形式重新散布，也禁止用於 NFT／play-to-earn。實作與發布前必須確認：

- 儲存庫與下載方式不會把模型當成可獨立取得的資產包散布。
- 任務捲沒有真錢兌換、交易或可變現機制。
- 不把模型或衍生圖像用作商標或 logo。
- 新增每一個角色、寵物、裝飾都要保存來源與授權記錄。

---

## 10. 寵物行為

### 10.1 跟隨寵物

- 同時最多一隻。
- 與角色保持安全距離，不與角色完全重疊。
- 角色移動時 follow；停止時切 idle。
- 距離過遠或卡住時允許淡出／重定位到角色附近，避免永久迷路。

### 10.2 世界閒逛寵物

- 其他已擁有寵物可選擇「放出來閒逛」。
- 基本狀態機：`idle -> choose target -> wander -> idle`。
- 只能在可行走區域活動，不得穿越 terrain 邊界或被裝飾永久卡住。
- 使用 deterministic seed 或本地狀態即可，不需要同步每一幀座標。
- 切換孩子時必須重建該孩子自己的寵物集合。

同時最多三隻閒逛寵物；其餘留在背包，由孩子更換放出名單。

---

## 11. 佈置模式

### 11.1 進入與退出

- 從背包的裝飾分頁選擇「放置」進入佈置模式。
- 進入佈置模式後暫停角色搖桿與一般相機手勢，避免手勢競爭。
- 顯示目前選中物件與移動、旋轉、縮放控制。
- 提供明確的「完成」與「取消」。
- 完成後保存；取消後回復進入模式前的 transform。

### 11.2 放置限制

- 只能放在允許的 terrain 區域。
- 不能進入角色出生點、中央大樹根部與其他保護區。
- 比例需限制在 catalog 定義的 min/max。
- 裝飾彼此不可重疊；預覽與保存 RPC 都必須依 footprint 驗證。
- 裝飾形成實際碰撞，角色不可穿越；寵物尋路需繞開。
- 不得埋入地面、超出世界或使用極端 scale。
- 提供「全部收回背包」，以單一交易停用／移除目前孩子的所有 decoration entities。
- 若未來 terrain 改版，需用 `world_layout_version` 遷移或安全重置不合法座標。

### 11.3 多裝置同步

- 儲存以伺服器版本為準。
- 每次 mutation 都帶 `expected_revision`，避免兩台裝置後存的舊資料覆蓋新資料。
- revision 不符時拒絕保存並提示重新載入；不得採 last-write-wins 或無聲合併不相容 transform。

---

## 12. 實作階段與驗收閘門

### Phase 0：決策鎖定

- 檢查第 13 節剩餘問題，不重複詢問已鎖定項目。
- 3D 場景使用全畫面背景層，現有孩子 UI 疊在上方。
- 確認任務捲中文名稱、程式命名與正式圖示。
- 商品 catalog 由開發者以 production migration 維護；家長只調整家庭價格。

### Phase 1：場景元件化

- 將 Prototype 拆為可測試的 terrain、camera、character、input modules。
- 加入 Three.js 專案依賴，移除 CDN runtime import。
- 建立 lazy-loaded React scene bridge。
- 壓縮 `big-tree.glb` 貼圖與模型，建立低階品質 tier，將草地改為可分區 cull／LOD。
- 建立 WebGL／資產失敗的 2D fallback；登入與家長模式不得下載 Three.js chunk 或 GLB。
- 保持既有孩子 UI、任務卡與面板可操作。
- 驗證切換孩子／登出後沒有殘留 renderer 或控制事件。

### Phase 2：動態搖桿與跨裝置控制

- 場景任意空白位置叫出搖桿。
- UI 命中不觸發走路。
- 實作單指搖桿、雙指拖曳視角與雙指捏合縮放。
- 保留桌面鍵盤控制。
- 加入 reduced motion、pointer cancel、背景切換與旋轉處理。

### Phase 3：任務捲帳務

- 建立 wallet、ledger、RLS 與交易 RPC。
- 單筆核准與批次核准都發一張任務捲。
- 防止重複核准／重試造成重複發放。
- 完成誤核准一鍵撤銷、反向帳本與已花獎勵保留規則。
- 左上統計顯示任務捲。

### Phase 4：商品、背包與裝備

- 建立 catalog、inventory、loadout。
- 建立家庭商品價格覆寫與家長價格設定。
- 遷移 starter anime maiden。
- 擴充背包選單與設定層級。
- 完成商店購買交易、餘額更新、角色裝備。

### Phase 5：寵物

- 一隻跟隨寵物。
- 最多三隻其他寵物放入世界並 idle／wander。
- 增加可見上限與低效能降級策略。

### Phase 6：裝飾與佈置

- 放置、旋轉、縮放、取消、保存。
- terrain 邊界與 scale 驗證。
- 裝飾不可重疊，並加入角色與寵物碰撞／繞路。
- 加入角色出生點禁放區與「全部收回背包」。
- 多裝置衝突處理。

### Phase 7：效能、離線與發布硬化

- 375x709、390px breakpoint、平板直／橫向、1440x900 驗證。
- iOS／Android Capacitor 真機觸控驗證。
- 場景資產載入失敗 fallback。
- 低階裝置像素比、陰影、草量、寵物數量與動畫降級。
- 完成 bundle size、memory leak、WebGL context loss、離線限制與安全檢查。

---

## 13. 已確認決策與剩餘邏輯問題

### 13.1 任意位置搖桿與相機旋轉

已確認採用：單指在場景任意空白位置控制動態搖桿；雙指一起拖曳轉視角；雙指距離變化控制縮放。所有手指放開後才能開始下一次搖桿手勢。

### 13.2 3D 世界覆蓋範圍

已確認 3D 世界成為全畫面背景層，現有任務卡、統計、背包按鈕與功能面板疊在上面。介面層仍需攔截 pointer event，避免點 UI 時角色移動。

### 13.3 任務捲與點數同時發放

已確認任務捲是獨立貨幣，現有點數保留。家長核准後：

```text
照原規則增加核准點數 + 固定增加 1 張任務捲
```

任務捲不取代現實獎勵、願望與點數兌換流程。

### 13.4 哪些核准任務能得到任務捲

已確認以下每個任務第一次進入 `completed` 都固定 `+1`：

- 每日冒險
- 一般冒險
- 孩子提出、家長後來核准的冒險
- 核准點數為 0 的任務
- 批次核准的每一個任務

發放與點數高低無關；重試、批次核准或更正後再次核准不得重複發放。

### 13.5 誤核准更正

已確認採用一鍵撤銷流程，詳細規則見第 7.4 節。家長按一次「撤銷」即可；若獎勵尚未使用便自動收回，已使用則保留但不允許再次發放。系統永遠保留原始與更正帳本，餘額不得變成負數。

### 13.6 商店內容與價格管理

已確認商品、模型、分類與上下架由開發者以 production migration 維護固定 catalog；seed 只供本機與測試。家長只能調整自己家庭的任務捲價格；未設定時使用 catalog 預設價格。

### 13.7 商品重複購買

已確認角色與寵物不可重複購買。裝飾可重複購買，不設定產品數量上限；購買與每個世界實體仍分別寫入帳本與庫存。

### 13.8 閒逛寵物上限

已確認：

- 跟隨寵物：最多 1 隻。
- 場景閒逛寵物：最多 3 隻。
- 其餘留在背包，可由孩子更換放出名單。

### 13.9 佈置可用範圍與碰撞

已確認：

- 保留角色出生點與中央大樹根部禁放區
- 裝飾彼此不可重疊
- 裝飾會阻擋角色與寵物，移動系統需停止或沿碰撞面滑動，寵物需繞路
- 佈置預覽以綠色／紅色或等價非純色訊號表示可否放置
- 提供「全部收回背包」安全操作

### 13.10 離線規則

此項仍採以下安全規則：

- Capacitor bundled assets 與同頁 session cache 可離線走動、查看已載入庫存與場景。
- Web 第一版不承諾冷啟動離線載入 3D 資產；專案目前沒有 service worker／Workbox。
- 離線不可購買、裝備新物品或確認佈置保存。
- 任務完成仍依既有 queue 送出；任務捲要等伺服器家長核准後才出現。

### 13.11 初始角色與既有 2D 角色的呈現

已確認所有孩子先取得 Prototype 目前的 anime maiden 作為免費 3D 初始角色；現有 2D `character_id` 保留且不改。

### 13.12 設定的名稱

正式介面使用「設定」。通知設定、切換視角與登出放在此面板。

### 13.13 無上限裝飾與場景效能

裝飾購買數量已確認不設產品上限，但同時放進 3D 世界的物件數量會影響記憶體、draw calls、碰撞檢查與載入時間。第一版不限制孩子擁有數量；場景端必須使用 instancing、Level of Detail (LOD)、空間索引與裝置效能降級。若真機仍無法維持操作流暢，再與使用者討論「同時放置上限」，不能私自限制已購買庫存。

---

## 14. 測試與驗收清單

### 14.1 帳務與安全

- 同一任務重複核准或 RPC 重試，只增加一張任務捲。
- 批次核准 N 個首次完成任務，增加 N 張。
- 退回補充不增加任務捲。
- 非家長不能核准任務或調整任務捲。
- 孩子不能直接修改錢包餘額、其他孩子庫存或世界資料。
- 購買失敗、餘額不足、商品下架或重複購買均不扣款。
- 購買成功時帳本、餘額與庫存同時完成。
- 家長價格覆寫只影響自己家庭，移除覆寫後恢復預設價格。
- 孩子無法把前端偽造價格送進購買 RPC。
- 誤核准撤銷時，未花獎勵會寫反向帳本並收回。
- 誤核准撤銷時，已花獎勵不造成負數，再次核准也不重複發放。

### 14.2 孩子隔離

- 切換孩子後，任務捲、角色、寵物、裝飾與場景全部切換。
- 孩子 A 不得讀取或操作孩子 B 的遊戲資料。
- 家長預覽孩子模式時操作的是明確選中的孩子。
- 刪除孩子時依外鍵／RPC 清理其遊戲資料，不影響兄弟姊妹。

### 14.3 場景與控制

- 3D 場景空白位置任意按下都可叫出搖桿。
- 點擊背包、任務卡、商店商品不會讓角色移動。
- `pointercancel`、開啟面板、切到背景、切換孩子後角色立即停止。
- 桌面 WASD／方向鍵仍可用。
- 單指搖桿、雙指拖曳視角與雙指捏合縮放通過手機與平板測試。
- 角色不離開 terrain 邊界。

### 14.4 背包、寵物與佈置

- 背包正確分成角色、寵物、裝飾。
- 只能裝備自己擁有的角色。
- 同時最多一隻跟隨寵物。
- 閒逛寵物遵守上限與場景邊界。
- 裝飾不可重疊，角色與寵物不能穿越裝飾碰撞範圍。
- 佈置取消能還原，完成能跨登入／跨裝置讀回。
- 不合法座標、scale 或其他孩子的 inventory ID 會被後端拒絕。

### 14.5 UI 與效能

- 現有孩子任務板、功能面板與家長解鎖流程沒有回歸。
- 左上加入天數、點數、任務捲在 375px 寬度不溢出。
- 背包展開順序符合本文件，切換視角與登出只在設定中。
- 所有觸控目標至少 44px，鍵盤 focus 清楚。
- Reduced Motion 下移除不必要彈跳，但保留操作回饋。
- 低階裝置降級後仍可完成任務、開商店與使用背包。
- 場景卸載後沒有持續 requestAnimationFrame、重複事件或 WebGL memory leak。

---

## 15. 完成定義

本功能只有在以下條件全部成立時才算完成：

- 3D 世界已成為孩子模式的一部分，且不是 iframe／CDN prototype 拼接。
- 現有孩子介面與任務流程可正常使用。
- 任務捲由家長核准交易安全發放，且具完整帳本與防重複約束。
- Supabase migrations 可從空資料庫重播，所有新表已啟用 RLS，RPC 權限與 execute grant 已驗證。
- 商店購買是單一原子交易。
- 開發者固定 catalog 與家長家庭價格覆寫均已完成。
- 每個孩子的庫存、裝備、寵物與世界資料完全隔離。
- Starter anime maiden 已安全 backfill 給既有孩子。
- 動態搖桿、相機方案、佈置手勢沒有互相搶事件。
- 手機、平板、桌面、Capacitor 真機、離線與低效能 fallback 均有驗證紀錄。
- 新增與既有 3D 資產的授權來源已記錄且符合發布方式。

---

## 16. 第一波代理報告摘要

本節保存本輪代理回報，讓下一位 AI 不必重新探索相同問題。證據路徑均指向目前工作區。

### 16.1 Supabase／SQL 回報

SQL 代理在使用者要求暫停時尚未完成最終報告。中止前已確認四個阻斷點：

1. `private.enforce_task_submission` 會拒絕 `completed` 任務的任何更新。`revoke_task_approval` 不能直接把任務改回 `pending`，必須設計受控更正路徑，且不能全面放寬 trigger。
2. 現有 `point_ledger` 對 `task_id` 的唯一約束與 entry check 不允許同一任務寫反向帳。新 migration 必須擴充 ledger entry type、唯一條件與 reversal linkage。
3. `batch_review_daily_adventures` 依輸入順序逐筆鎖任務。加入同孩子 wallet 鎖後，兩個交錯批次可能死鎖。批次 RPC 應去重並排序 task ID，再以固定順序鎖任務與孩子錢包。
4. 原計畫只有 `source_purchase_id`，沒有 purchase receipt 與 request ID。裝飾購買遇到網路重試時會重複扣款，因此已在 6.9 節新增 `game_item_purchases`。

接手者應優先檢查：

- `supabase/migrations/20260720171257_habithero_schema_rls_rpc.sql`
- `supabase/migrations/20260722110713_child_led_growth_feedback.sql`
- `supabase/migrations/20260729090529_harden_rpc_authorization.sql`
- `supabase/migrations/20260731061332_child_adventure_board.sql`

### 16.2 3D 場景回報

場景代理確認 Prototype 只能作為視覺與演算法來源，不能直接搬入 React：

- 專案尚未安裝 `three`；Prototype 使用 CDN `three@0.181.1`
- Prototype 沒有取消 animation frame、移除 listener 或 dispose renderer／texture／geometry／material／mixer
- React 主程式使用 StrictMode，缺少冪等 cleanup 會產生雙 renderer 或雙 listener
- `big-tree.glb` 約 30 MB，內含三張 4096×4096 貼圖；角色約 4.6 MB
- Prototype 的手機草量約 68,436 instances，桌面約 205,248 instances，且關閉 frustum culling
- 現有資產在手機可能使用超過 280 MiB 級 GPU 貼圖記憶體；資產瘦身與品質 tier 必須提前到 Phase 1
- `DashboardCharacterHero` 應增加 `sceneLayer` slot；家長端保留圖片，孩子端 lazy load 3D
- 場景完整卸載必須停止 loop、清 input、移除 listener、停止 mixer、釋放場景專屬資源、釋放 cache reference、dispose renderer
- Skinned mesh 必須使用 `SkeletonUtils.clone`，不能使用一般 `clone(true)`
- 第一版使用平坦 XZ 世界的圓形／capsule 碰撞，不需要立即引入物理引擎

關鍵證據：

- `terrain-prototype/index.html:184`
- `terrain-prototype/index.html:489`
- `terrain-prototype/index.html:553`
- `terrain-prototype/procedural-grass-field.js:26`
- `terrain-prototype/procedural-grass-scene.js:248`
- `src/main.tsx:7`

### 16.3 手機控制回報

控制代理確認 Prototype 的 pointer 狀態管理必須重寫：

- 現有單指拖曳控制相機，不是動態搖桿
- 雙指只計算 pinch，沒有使用兩指中心位移旋轉相機
- 任一指放開後會立即恢復剩餘單指，違反「全部放開後才能重新開始」
- 正式狀態固定為 `idle`、`joystick`、`camera-two-finger`、`await-all-released`
- 第二指加入時，同一 reducer step 必須讓 movement 歸零
- 第三指加入視為歧義，進入 `await-all-released`
- 搖桿半徑先採 56 px、dead zone 10 px、顯示 opacity 約 0.65、放開 240 ms 淡出
- canvas 使用 `touch-action: none`；不得把此規則加到整個孩子頁面
- 控制器必須處理 `pointercancel`、`lostpointercapture`、blur、hidden、pagehide、resize、面板開啟、切換孩子與卸載
- mouse 保留拖相機，WASD／方向鍵保留；表單、contenteditable 與 dialog 聚焦時不攔截鍵盤
- 場景每幀讀取 input snapshot，不把每次 pointer move 寫入 React state

建議模組：

```text
src/features/world/input/
  world-input-types.ts
  world-input-reducer.ts
  pointer-input-controller.ts
  keyboard-input.ts
  input-math.ts
  DynamicJoystick.tsx
```

關鍵證據：

- `terrain-prototype/index.html:441`
- `terrain-prototype/index.html:514`
- `terrain-prototype/index.html:529`
- `terrain-prototype/index.html:553`
- `tests/terrain-prototype-controls.test.ts:8`

### 16.4 孩子 UI 回報

UI 代理確認現有視覺可保留，但元件責任必須拆開：

- `ChildDashboard.tsx` 目前約 822 行，混合選單、功能頁、獎勵、設定與 modal
- `DashboardCharacterHero` 應增加 `sceneLayer?: ReactNode`
- 固定兩組 stat props 應改成 `stats[]`；父端傳兩項，孩子端傳加入天數、點數、任務捲三項
- 選單第一層固定為冒險日記、背包、商店、獎勵、成長、設定
- 設定改成完整 feature panel，內含通知、切換視角／孩子與登出
- `child_profiles.character_id` 繼續服務 2D 身分與 fallback，不能當 3D catalog ID
- 切換孩子時必須清除 feature、商品選擇、確認視窗、背包分頁與世界 input
- 三項統計在 375 px 需要 `minmax(0, 1fr)` 三欄布局與 tabular numbers
- 六個選單動作需要可捲動高度限制，總 reveal 時間壓在約 300 ms
- feature panel 需要初始焦點、Escape、焦點返回與背景 inert

CSS owner 固定為：

| 責任 | Owner |
| --- | --- |
| HUD、統計、右上選單與 safe area 幾何 | `src/styles/character.css` |
| 表面色、邊框與陰影 | `src/styles/neutral-theme.css` |
| Feature overlay、backdrop、z-index 與滾動 | `src/styles/overlays.css` |
| 背包／商店／設定內部元件 | `src/styles/modals.css` |
| 3D canvas | `src/styles/world.css` |
| 虛擬搖桿 | `src/styles/world-controls.css` |

若新增兩個 world CSS 檔，必須同步更新 `CSS_RULES.md` 與 `src/styles/index.css` import 契約。

關鍵證據：

- `src/components/ChildDashboard.tsx:59`
- `src/components/ChildDashboard.tsx:430`
- `src/components/ChildDashboard.tsx:796`
- `src/components/DashboardCharacterHero.tsx:24`
- `src/styles/character.css:848`
- `tests/ui-behavior.test.ts:272`

### 16.5 測試與風險回報

測試代理確認現有基礎是 `node:test + tsx`，不是 Vitest 或 Playwright：

- 基線為 37 個測試檔、210/210 通過
- 尚無 pgTAP、Playwright、coverage 或 CI workflow
- 現有 SQL 與 UI 測試多為 migration／原始碼 regex，無法證明真實 RLS、並發、DOM hit test 或 WebGL dispose
- `scripts/security-check.mjs` 只檢查舊表，新增遊戲表後必須擴充
- 購買、核准與世界放置需要 local Supabase 的雙 client 並發測試
- 測試 harness 必須拒絕任何非 `127.0.0.1:54321` URL，避免誤寫遠端
- 裝飾位置 RPC 需要 `expected_revision` 與孩子世界鎖，才能保證雙裝置不可重疊
- 同一寵物不可同時 following 與 roaming，RPC 必須鎖 loadout 與 world entity 後驗證
- Web 版離線資產尚無 service worker。第一版只承諾 Capacitor bundled assets 與同頁 session cache；不要宣稱 Web 冷啟動離線可用

最優先新增的測試：

```text
supabase/tests/database/game_economy_schema.test.sql
supabase/tests/database/game_economy_rls.test.sql
supabase/tests/database/game_economy_approval.test.sql
supabase/tests/database/game_economy_purchase.test.sql
supabase/tests/database/game_world_entities.test.sql
tests/game-economy-contract.test.ts
tests/world-input-machine.test.ts
tests/world-collision.test.ts
tests/world-scene-lifecycle.test.ts
```

## 17. 第一波後鎖定的技術決策

第一波分析補齊以下規格。接手者除非先更新本計畫，否則不得自行改回未定義狀態：

1. 購買需要 `game_item_purchases` 與 UUID idempotency key
2. 正式購買價格至少一張任務捲；免費 starter 不走購買 RPC
3. 世界 mutation 使用 `child_world_states.revision`、`expected_revision` 與孩子世界鎖
4. 第一版裝飾 footprint 使用 XZ 圓形半徑，scale 會放大半徑
5. 誤核准撤銷分別追回點數與任務捲，不採全有或全無
6. 同一寵物不可同時 following 與 roaming
7. 批次核准先去重、排序並固定鎖定順序
8. 資產瘦身、品質 tier 與 WebGL fallback 提前到 Phase 1
9. Web 第一版不承諾冷啟動離線載入 3D 資產
10. 正式 input 必須是純 reducer／controller contract，不能沿用 Prototype 的 pointer 狀態

## 18. 下一位 AI 的接手順序

下一位 AI 應按以下順序繼續，避免同時改動共用檔造成衝突：

1. 重新執行 `git status --short`，辨識本輪前已存在的使用者變更
2. 完整閱讀 `AGENTS.md`、`CSS_RULES.md` 與本計畫
3. 先用測試固定 input contract、購買 idempotency、approval reversal 與世界 revision
4. 使用 `supabase migration new <name>` 建立 migration；不得手寫 timestamp
5. 先完成 schema、RLS、RPC 與 pgTAP，再接資料存取層
6. 固定 `src/features/world/contracts.ts`，再平行實作 scene 與 input
7. 安裝並固定 `three@0.181.1`，把 Three.js 留在 lazy child chunk
8. 先做可 dispose 的最小場景與 2D fallback，再移植高成本草地與大樹
9. 建立 game data adapter 與純呈現 panels，最後由單一整合者修改 `ChildDashboard.tsx`
10. 執行第三波獨立審核，再跑 lint、tests、build、security check 與 diff review

共用檔的最終整合權應保持集中：

- `src/types.ts`
- `src/store.tsx`
- `src/components/ChildDashboard.tsx`
- `src/lib/data-access.ts` 或新的共用 data repository interface
- migration 順序與最終 SQL
- `package.json` 與 lockfile

## 19. 暫停時的驗收結論

本輪只完成分析與交接文件。基線程式在變更前通過 TypeScript lint 與 210 項測試，但本計畫描述的 3D 世界、任務捲、商店、背包、寵物與佈置功能尚未實作，也未驗證可運作。下一位 AI 必須從第二波實作開始，不能從第三波審核或發布開始。
