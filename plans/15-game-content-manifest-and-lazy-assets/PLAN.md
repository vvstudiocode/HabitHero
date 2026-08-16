# HabitHero 遊戲資產 Manifest、未知商品防護與延遲載入計畫

**狀態：** 規劃完成，尚未開始實作

**日期：** 2026-08-16

**內容類型：** 技術實作計畫與驗收規格

**範圍：** 角色、寵物、裝飾的本地資產解析、SQL catalog 與 App 版本相容、商店／背包防破圖、3D 模型延遲載入、遊戲狀態樂觀更新

**不在本計畫範圍：** 遠端 CDN／Storage 模型熱更新、移除 `game_catalog_items`、重新設計商店 UI、改造 Supabase 經濟 RPC、改變現有產品價格與商品內容

本文件只規劃，不代表功能已完成。實作前必須重新閱讀根目錄 `AGENTS.md`、`CSS_RULES.md` 與 `plans/14-terrain-world-economy/PLAN.md`。

---

## 1. 目標

### 1.1 必須解決的問題

1. SQL 商品先上架，但目前 App 沒有圖片或 GLB 時，不得出現破圖、404、模型 loader 失敗或整個世界載入失敗。
2. 商店只能顯示目前 App 真正支援的商品。
3. 已擁有但已退役、或目前 App 不認識的商品不可被刪除；必須保留資料並提供安全提示或 fallback。
4. 進入 3D 世界時只載入實際需要的模型，不載入整個 catalog 的 GLB。
5. 既有購買、換裝、寵物跟隨、寵物漫遊、裝飾放置／移動／收回流程維持樂觀更新，不因新資產防護而退回等待式 UI。
6. 角色、寵物、裝飾的視覺資產有單一的 App 端來源，不再由 SQL `thumbnail_url` 或 `metadata.model` 任意決定本地資產路徑。

### 1.2 成功後的責任分層

```text
App manifest
  ├── assetKey
  ├── 名稱與描述
  ├── 本地模型路徑
  ├── 本地縮圖路徑
  ├── 動畫與純視覺設定
  └── App 是否能渲染此資產

SQL
  ├── 商品是否存在與上架狀態
  ├── 價格與可購買規則
  ├── 玩家擁有、裝備與世界狀態
  └── 伺服器端碰撞與縮放安全規則
```

### 1.3 非目標

- 不要求新增資產永遠不更新 SQL；可購買、可擁有、可放置的商品仍需要 SQL catalog 資料。
- 不讓 App 端成為價格、購買合法性或世界寫入的權威。
- 不用 `HEAD`、網路探測或瀏覽器載入失敗來判斷資產是否支援；支援狀態必須由編譯期／測試期 manifest 驗證決定。
- 不在第一階段加入遠端模型 URL。SQL 不得把舊版 App 指向一個未打包的本地 `/assets/` 路徑。

---

## 2. 目前程式狀態與風險

### 2.1 已確認的資料來源分散

| 內容 | 現況 | 風險 |
| --- | --- | --- |
| 角色 | `world-character-catalog.ts` 有本地模型與縮圖 | 與 SQL catalog 內容重複 |
| 寵物 | `pet-model-assets.ts` 只有部分 canonical path，其餘 fallback SQL metadata | 新寵物可能只存在 SQL、不存在本地 resolver |
| 裝飾 | runtime 主要從 SQL `metadata.model` 取模型 | SQL 提前上架會直接造成模型載入失敗 |
| 商店 | `ChildGamePanel.tsx` 只篩 `isActive` | 未檢查 App 是否支援資產 |
| 商品縮圖 | `GameItemImagePreview.tsx` 直接使用 `item.thumbnailUrl` | SQL 路徑不存在時出現破圖 |
| 世界解析 | `game-data.ts` 將 SQL catalog 當完整渲染資料 | catalog、視覺資料與玩家狀態耦合 |
| 模型載入 | runtime 依 catalog 建立模型載入清單 | 可能載入尚未使用的裝飾或不支援商品 |

### 2.2 必須保留的現有能力

- `game_catalog_items` 仍是購買與商品規則的伺服器來源。
- `child_inventory_items`、`child_game_loadouts`、`child_world_entities` 的資料關係不能被破壞。
- `purchase_game_item`、`equip_game_character`、`set_following_pets`、`set_roaming_pets` 與世界佈置 RPC 維持伺服器權威。
- 現有樂觀更新模組必須延續：
  - `src/features/world/game-loadout.ts`
  - `src/features/world/world-optimistic.ts`
  - `src/features/world/pet-name-optimistic.ts`
  - `src/store.tsx` 的 `mutate` rollback／reconcile 流程

---

## 3. 目標資料模型

### 3.1 建立統一 manifest

建議新增：

```text
src/features/world/game-content-manifest.ts
```

如果單檔過大，可以拆成：

```text
src/features/world/content/characters.ts
src/features/world/content/pets.ts
src/features/world/content/decorations.ts
src/features/world/content/index.ts
```

每個定義至少包含：

```ts
interface GameContentDefinition {
  assetKey: string;
  itemType: 'character' | 'pet' | 'decoration';
  name: string;
  description: string;
  modelUrl: string;
  thumbnailUrl: string;
  visual: {
    groundOffset?: number;
    visualScaleMultiplier?: number;
    animation?: string;
    renderMode?: string;
  };
}
```

規則：

- `assetKey` 是跨 App、SQL、inventory、world entity 的穩定識別碼。
- 新增資產必須先有 manifest 定義，再允許建立可見商品。
- `modelUrl` 與 `thumbnailUrl` 必須指向 `public/assets` 內的檔案。
- 不接受任意 SQL 提供的本地資產 URL。
- 舊版或已退役且未隨目前 App 打包的商品可以不在 manifest，但必須能被安全標記為 unavailable。

### 3.2 渲染能力與商品狀態分開

`GameCatalogItem` 是伺服器商品資料；建議透過 resolver 產生 App 渲染資料，不把 SQL row 直接當成 UI model：

```ts
interface ResolvedGameCatalogItem extends GameCatalogItem {
  content: GameContentDefinition | null;
  supported: boolean;
  supportsThumbnail: boolean;
  supportsModel: boolean;
}
```

判斷規則：

- `supported`：manifest 有定義且資產驗證通過。
- `supportsThumbnail`：可安全顯示商店／背包縮圖。
- `supportsModel`：可安全進入 3D runtime 載入。
- `isActive`：仍然只代表 SQL 是否上架。
- `owned`：由 inventory 與 loadout 推導，不能與 `supported` 混用。

### 3.3 SQL 欄位責任

第一階段不刪欄位、不新增必要 migration。現有 SQL 欄位暫時保留，但新 App 不再依賴以下欄位作為本地資產來源：

保留並繼續使用：

- `id`
- `item_type`
- `asset_key`
- `scroll_price`
- `is_active`
- `is_starter`
- `is_stackable`
- `sort_order`
- `collision_radius`
- `min_scale`
- `max_scale`

逐步停止作為 App 視覺來源：

- `thumbnail_url`
- `metadata.model`
- `metadata.thumbnail`
- `metadata.compression`
- `metadata.renderMode`
- 純視覺的 ground offset、visual scale、動畫與 idle 設定

碰撞半徑與縮放範圍仍由 Supabase RPC 在伺服器端驗證；manifest 可提供 UI 預設值，但不能取代伺服器檢查。

---

## 4. Phase 1：資產盤點與 manifest 驗證

### 4.1 工作內容

1. 列出目前 `public/assets/characters`、`public/assets/pets`、`public/assets/decorations` 的所有檔案。
2. 對照所有目前 active catalog 的 `asset_key`。
3. 對照已存在 inventory／world entity 的 legacy key。
4. 把所有目前仍可渲染的角色、寵物、裝飾加入 manifest。
5. 對於沒有本地模型或縮圖的 legacy item，標記為 unavailable，不刪除資料。
6. 移除角色、寵物、裝飾中重複的視覺 path 定義；保留相容 adapter 直到 Phase 2 完成。

### 4.2 自動驗證

新增 manifest contract test，至少驗證：

- `assetKey` 不重複。
- 所有 `modelUrl` 檔案存在。
- 所有 `thumbnailUrl` 檔案存在。
- `itemType` 與 key prefix 一致。
- 不引用外部任意 URL。
- active 且預期可販售的本地商品具有縮圖。
- 可進入世界的商品具有模型。

### 4.3 Phase 1 完成條件

- 不需要修改 SQL schema。
- 所有目前要顯示的商品都有 manifest 定義。
- 未知 SQL item 可以被 resolver 明確標記為 unsupported。
- `npm run lint`、`npm test`、`npm run build` 通過。

---

## 5. Phase 2：SQL catalog 防破圖與 App 端解析

### 5.1 Catalog hydration

在 `game-data.ts` 將 SQL row 轉換成 App model 時：

```text
SQL row.asset_key
  ↓
manifest lookup
  ↓
ResolvedGameCatalogItem
```

要求：

- manifest 定義存在：使用 manifest 的名稱、描述、圖片、模型與視覺設定。
- manifest 定義不存在：保留 SQL item，但 `supported = false`。
- SQL 的 `thumbnail_url` 不可作為未知 item 的 fallback 圖片。
- SQL 的 `metadata.model` 不可作為未知 item 的 fallback 模型。
- 避免因一筆未知 item 讓整個 `loadChildGameData` 失敗。

### 5.2 商店

`ChildGamePanel.tsx` 的商店篩選必須符合：

```text
item.isActive
&& !item.isStarter
&& item.supportsThumbnail
```

商店行為：

- 只渲染 manifest 提供的縮圖。
- 商店卡片不載入 GLB。
- 只有使用者打開目前已有的圖片 lightbox 時，才載入縮圖大圖；不啟動 3D 模型。
- SQL 新增但 App 不支援的 item 不出現在商店。
- 購買 API 仍須由 Supabase RPC 再次驗證 item 是否可購買。

### 5.3 背包

背包必須保留玩家擁有的資料，即使商品 inactive 或 App 不支援：

- known + supported：正常顯示與操作。
- inactive + supported：顯示但禁止購買，可依產品規則繼續裝備／使用。
- owned + unsupported：顯示「此物品需要更新 App」，不可預覽、裝備、跟隨或放置。
- 不得因 unsupported 而刪除 inventory、loadout 或 world entity。

### 5.4 世界

- 未知角色：使用預設角色，不讓世界初始化失敗。
- 未知寵物：不建立 pet actor；保留 SQL entity，必要時顯示一次更新提示。
- 未知裝飾：不載入 GLB；保留 world entity，使用非破壞性 placeholder 或在場景中暫時隱藏。
- 不允許 unknown item 進入 GLTF loader。
- 不允許 SQL arbitrary URL 進入 loader。

### 5.5 Phase 2 完成條件

- 將一筆不存在於 manifest 的 active SQL row 注入測試資料，商店不顯示破圖。
- 將一筆已擁有但 unsupported 的 inventory row 注入測試資料，背包不崩潰且顯示更新提示。
- 未知 world entity 不會讓整個 3D 世界載入失敗。
- 所有圖片與模型來源都可追溯到 manifest。

---

## 6. Phase 3：模型延遲載入與載入範圍

### 6.1 進入世界時允許載入

只允許載入以下必要資產：

1. 目前裝備角色。
2. 正在跟隨的寵物。
3. 世界中已啟用且支援的寵物。
4. 世界中已放置且支援的裝飾。
5. 正在預覽或正在放置的支援裝飾。

### 6.2 不應載入

- 尚未購買的寵物模型。
- 尚未跟隨、未漫遊、未放置的寵物模型。
- 未放置的裝飾模型。
- 只存在於商店、目前沒有 3D 預覽需求的 GLB。
- 只有 SQL row、manifest 不支援的商品。
- 已被過濾掉的 inactive legacy item。

### 6.3 需要調整的 runtime 行為

目前 runtime 中建立裝飾模型清單的邏輯必須確認只接受：

- active world decoration
- current placement item

不得直接使用完整 catalog 建立所有 decoration model load。

寵物模型清單必須只從：

- following pet inventory
- active pet world entities

建立，並先過濾 `supportsModel`。

### 6.4 載入生命週期

- 以 `modelUrl` 作為 cache key，避免同一 GLB 重複下載／解析。
- 每個模型 URL 只允許一個 pending load promise。
- scene unmount、切換孩子、登出或 AbortSignal 取消時停止未完成載入。
- 已不再使用的模型 instance 釋放 clone、mixer、material、geometry 與 texture。
- 任何模型載入失敗都不能把 SQL 狀態 rollback；顯示 fallback／更新提示並保持資料一致。
- known manifest item 的模型載入失敗與 unknown item 分開記錄，方便診斷 bundle 或路徑問題。

### 6.5 商店資產策略

```text
商店開啟：載入縮圖
商品卡片：不載入 GLB
圖片 lightbox：只使用縮圖
3D 預覽若未來加入：點擊後才載入，關閉後釋放或使用短期 cache
```

### 6.6 Phase 3 完成條件

- 進入世界的 GLB load list 只包含必要模型。
- 未購買且未使用的寵物不會觸發模型載入。
- 未放置裝飾不會觸發模型載入。
- 商店只觸發縮圖載入。
- 連續切換孩子與進出世界不造成 loader、animation loop 或 WebGL resource 累積。

---

## 7. Phase 4：樂觀更新與資產狀態協調

樂觀更新必須保留。資產是否已載入與玩家狀態是否已寫入是兩件事，不能互相綁死。

### 7.1 共通原則

每個 mutation 需要具備：

```text
server snapshot
optimistic patch
pending operation identity
success reconcile
failure rollback
```

不得用一次全量 reload 取代所有樂觀更新，也不得讓後來完成的舊 request 覆蓋較新的使用者操作。

### 7.2 購買

沿用 `game-loadout.ts` 現有流程：

1. 點擊購買後立即扣除本地任務捲。
2. 立即加入暫時 inventory row。
3. RPC 成功後以 server `inventory_item_id`、數量與餘額 reconcile。
4. RPC 失敗後只 rollback 該筆 purchase，不覆蓋後續成功或 pending purchase。
5. unsupported item 不得進入可購買 UI；即使惡意呼叫，RPC 仍是最後驗證。
6. 購買成功但 GLB 尚未載入，不得視為購買失敗；背包顯示商品並由世界載入器按需處理。

### 7.3 角色換裝

沿用 `patchEquippedCharacter`：

1. RPC 前立即切換本地 equipped inventory id。
2. 世界可先切換至 manifest 已知模型；模型尚未完成時顯示 loading 或保留前一個 actor。
3. RPC 成功後以 server loadout reconcile。
4. RPC 失敗後恢復上一個 loadout。
5. unsupported character 不可執行換裝。
6. 模型載入失敗不應寫回或刪除玩家裝備資料；顯示可恢復錯誤並保留 server state。

### 7.4 跟隨寵物與漫遊寵物

沿用 `patchFollowingPets`、`patchRoamingPets`：

- 先更新跟隨順序與本地 world entity。
- server 成功後更新 revision 與 entity id。
- server 失敗後恢復 server snapshot。
- 模型尚未載入時可顯示 loading／placeholder，但不能因 loader latency 阻塞選擇操作。
- unsupported pet 不可加入 following／roaming selection。
- 同一隻寵物的連續操作必須以 operation token 或 pending snapshot 避免舊結果覆蓋新選擇。

### 7.5 裝飾放置、移動、收回

沿用 `world-optimistic.ts`：

#### 放置

1. 立即建立 local entity id。
2. 立即把裝飾顯示在暫定位置。
3. RPC 成功後以 server entity id 與 revision reconcile。
4. RPC 失敗後移除 local entity，恢復原本 inventory／world state。
5. unsupported decoration 不得進入放置流程。

#### 移動／旋轉／縮放

1. 立即 patch local transform。
2. 由既有 mutation queue 保持順序。
3. RPC 成功後更新 server revision。
4. server 拒絕碰撞、邊界或 revision conflict 時恢復上一個有效 transform，並顯示原因。
5. 不因 GLB 載入慢而重複送出 transform mutation。

#### 收回／全部收回

1. 立即隱藏或標記 inactive。
2. RPC 成功後 reconcile revision。
3. RPC 失敗後恢復原本 active entity。
4. 不刪除 inventory item。

### 7.6 寵物命名

沿用 `pet-name-optimistic.ts`：

- 先顯示新名稱。
- RPC 失敗後恢復原名稱。
- 未知商品不能從 SQL 名稱衍生錯誤 UI；應顯示 unavailable 狀態。

### 7.7 資產載入錯誤與樂觀狀態

必須分開處理：

```text
玩家 mutation 失敗
  → rollback 玩家狀態

模型載入失敗
  → 保留玩家狀態，顯示 fallback／更新提示
```

模型載入錯誤不能自動把已成功購買、已成功裝備或已成功放置的資料刪掉。

---

## 8. Phase 5：SQL 與發布相容

### 8.1 第一階段不新增 SQL migration

本計畫的防破圖核心不需要改 schema：

- SQL 繼續回傳 catalog row。
- App 以 `assetKey` 對照 manifest。
- `supported` 由 App 推導。
- SQL 先上架也不會讓不支援商品直接出現在商店。

### 8.2 新增商品流程

標準流程：

```text
1. 加入 GLB、縮圖
2. 加入 manifest
3. 通過資產驗證、lint、test、build
4. 發布 Web／iOS App
5. 新增或啟用 SQL catalog row
```

即使第 5 步意外早於第 4 步，App 仍必須因 `supported = false` 而不顯示商品。

### 8.3 既有模型版本切換

本計畫不導入遠端熱更新，但可支援未來的預先打包 variant：

- SQL 只能選擇 manifest 已知的 variant。
- SQL 不得任意指定 App 未打包的本地 URL。
- 未知 variant 視為 unsupported。
- 真正新增未打包 GLB 仍需要 App 更新。

### 8.4 iOS 注意事項

- 修改 `public/assets` 後執行 `npm run cap:sync`。
- 新模型如果沒有預先打包，必須提高 App build number 並發布新版本。
- 舊版 App 遇到新 SQL 商品時只能隱藏、fallback 或提示更新。
- 不刪除仍可能被舊 inventory／world entity 引用的舊資料。

### 8.5 Web 注意事項

- 新模型建議使用版本化檔名，避免同一 URL 快取舊模型。
- 確認 manifest 引用的檔案都在 Vite build 產物中。
- 不把 SQL migration 檔打入前端 bundle。

---

## 9. 實作檔案範圍

### 第一波可能修改

- `src/features/world/game-content-manifest.ts` 或 `src/features/world/content/*`
- `src/features/world/contracts.ts`
- `src/features/world/game-data.ts`
- `src/features/world/components/ChildGamePanel.tsx`
- `src/features/world/components/GameItemImagePreview.tsx`
- `src/features/world/pet-model-assets.ts`
- `src/features/world/world-scene-data.ts`
- `src/features/world/TerrainWorldLayer.tsx`
- `src/features/world/prototype-world-runtime.ts`
- `tests/game-content-manifest.test.ts`
- `tests/game-content-availability.test.ts`
- `tests/game-world-asset-loading.test.ts`

### 樂觀更新相關檔案

- `src/features/world/game-loadout.ts`
- `src/features/world/world-optimistic.ts`
- `src/features/world/pet-name-optimistic.ts`
- `src/store.tsx`
- 現有 `tests/optimistic-game-state.test.ts`
- 現有 `tests/world-optimistic.test.ts`

### 第一波不應修改

- Supabase schema
- Supabase RPC signature
- RLS policy
- 商品價格與現有商品內容
- `child_profiles` 身份資料規則
- 家長端非必要 UI

若未來確實需要移除 SQL visual metadata，再建立獨立 migration 與 rollback plan，不與第一波防破圖修正混做。

---

## 10. 測試與驗收

### 10.1 Manifest contract tests

- 所有 manifest asset key 唯一。
- 所有模型檔存在。
- 所有縮圖存在。
- 所有 active local catalog item 能解析到 manifest。
- SQL unknown item 的 `supported` 為 false。

### 10.2 商店與背包 tests

- `isActive = true`、manifest 不存在：不渲染商店卡片。
- `isActive = true`、縮圖缺失：不渲染圖片元素或使用安全 icon，不產生破圖。
- owned unknown item：背包顯示更新提示，不崩潰。
- 不支援 item 不可購買、換裝、跟隨或放置。
- 商店只渲染 manifest thumbnail，不讀 SQL arbitrary URL。

### 10.3 世界與 loader tests

- unknown pet 不進入 GLTF loader。
- unknown decoration 不進入 GLTF loader。
- 未購買且未使用的 pet 不進入 load list。
- 未放置 decoration 不進入 load list。
- following／active entity 才會進入 load list。
- model URL 相同時只產生一個 pending load。
- loader 失敗不會清除已成功的玩家狀態。
- world unmount 會取消 pending load 並清理 runtime 資源。

### 10.4 樂觀更新 tests

- 購買立即更新餘額與 inventory。
- 購買失敗只 rollback 該筆操作。
- 換裝立即更新，失敗後恢復前一個角色。
- 跟隨／漫遊立即更新，失敗後恢復 server snapshot。
- 放置立即出現 local entity，成功後 reconcile server entity。
- 放置失敗移除 local entity。
- 移動／旋轉／縮放維持 mutation queue 與 revision。
- server collision／revision rejection 會恢復前一個有效 transform。
- 收回與全部收回失敗後恢復 active entity。
- loader 失敗不觸發 mutation rollback。

### 10.5 建議驗證命令

```text
npm run lint
npm test
npm run build
git diff --check
```

若修改 CSS，額外依 `CSS_RULES.md` 執行 selector owner、responsive、狀態與視覺驗證。若啟動本機預覽或瀏覽器測試，必須依使用者要求與既有 browser QA 流程進行。

---

## 11. 風險與處理方式

| 風險 | 處理方式 |
| --- | --- |
| SQL catalog 有新商品但 App 無 manifest | `supported = false`，商店隱藏，世界跳過 |
| 已擁有 legacy item 無本地模型 | 保留 inventory，顯示更新提示或 placeholder |
| SQL metadata 與 manifest 不一致 | manifest 作為 App 視覺權威，伺服器規則仍由 SQL 驗證 |
| 新模型未打包到 iOS | 不允許透過 SQL 假裝支援，必須 App 更新 |
| 樂觀 UI 與模型載入時間不同 | mutation 狀態與 asset load 狀態分離 |
| 多次快速切換寵物 | operation snapshot／token／既有 queue 防止舊結果覆蓋新結果 |
| decoration loader 載入完整 catalog | 只傳入 active world entity 與 placement item |
| 新增資產忘記加縮圖 | build/test 阻擋，不能進入可販售 manifest |
| 舊 SQL migration 仍含 visual metadata | 第一階段保留相容性，App 不再依賴；後續再清理 |
| Web 快取舊模型 | 版本化檔名與部署後驗證 |

---

## 12. Definition of Done

本計畫完成時，必須同時滿足：

1. SQL 先上架未知商品不會出現在商店。
2. 不支援商品不會觸發圖片或 GLB 載入。
3. 已擁有的不支援商品不會被刪除。
4. 所有正常顯示的圖片與模型都來自 App manifest。
5. 商店只載入縮圖，不載入不需要的 GLB。
6. 世界只載入目前角色、跟隨／啟用寵物、已放置裝飾與目前預覽／放置資產。
7. 未購買寵物與未放置裝飾不會被載入。
8. 購買、換裝、跟隨、漫遊、放置、移動、收回與命名都有樂觀更新與可驗證 rollback。
9. 模型載入失敗不會破壞已成功的 SQL 玩家狀態。
10. 現有 lint、unit tests、build 與世界經濟 contract tests 維持通過。
11. 第一波不需要修改 SQL schema、RPC 或 RLS。
12. 後續新增資產有明確流程：先 manifest／App 資產，再商品 SQL；即使順序錯誤也不會破圖。

---

## 13. 建議實作順序

```text
Phase 0 盤點與基線
  ↓
Phase 1 統一 manifest 與資產驗證
  ↓
Phase 2 SQL catalog hydration 與 unsupported 防護
  ↓
Phase 3 世界模型延遲載入
  ↓
Phase 4 樂觀更新與 asset loading 狀態分離
  ↓
Phase 5 build／測試／相容性驗收
  ↓
之後才評估 SQL visual metadata 清理、variant 或遠端資產
```

第一個可交付版本只要完成 Phase 1 與 Phase 2，就能解決「SQL 商品先上架、App 沒資產」的破圖風險；Phase 3 與 Phase 4 負責改善模型流量、載入時間與操作體驗，不應和第一波防護混成一個不可回滾的大改動。
