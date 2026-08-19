# HabitHero 可維護性、模組邊界與檔案規模治理計畫

## 1. 任務目的

本任務只做結構治理與等價重構，不改產品流程、畫面、資料契約或 Supabase 行為。完成後，新的 AI 能從清楚的模組 owner、入口與測試理解專案，不需要在數千行檔案中修改彼此無關的功能。

執行前必讀：`AGENTS.md`、`CSS_RULES.md`、本文件，以及與修改範圍相關的既有 plan。開始前先執行 `git status --short`；現有未提交變更屬於使用者，不得覆寫、還原或順手整理。

## 2. 2026-08-19 盤點結論

目前沒有找到一份針對 TypeScript／React 的正式行數規格。`CSS_RULES.md` 已定義 CSS owner 與 cascade 規則，但沒有對其他程式碼建立相同的責任邊界與自動護欄。

正式來源（排除 `backups/`、生成檔與打包資產）的主要熱點如下：

| 檔案 | 行數 | 目前混合的責任 | 優先級 |
| --- | ---: | --- | --- |
| `src/features/world/prototype-world-runtime.ts` | 2,834 | Three.js 場景、資源生命週期、人物、寵物、裝飾、輸入、每幀更新 | P0 |
| `src/components/ParentDashboard.tsx` | 1,890 | 資料彙整、任務、獎勵、孩子帳號、導覽、表單與畫面 | P0 |
| `src/styles/modals.css` | 1,736 | 多種 modal 與 modal 內部元件 | P1 |
| `src/components/ChildDashboard.tsx` | 1,564 | 任務、音效、願望、遊戲購買、寵物、佈置與整頁渲染 | P0 |
| `src/styles/character.css` | 1,476 | 角色首頁幾何、選單、狀態與 responsive | P1 |
| `src/styles/world.css` | 1,022 | 3D 世界、面板、商店、背包與設定內容 | P1 |
| `src/store.tsx` | 995 | provider、domain state、同步與多領域 actions | P0 |
| `src/features/world/TerrainWorldLayer.tsx` | 923 | runtime bridge、輸入、選取、寵物動作、佈置控制與 overlay UI | P0 |
| `src/lib/data-access.ts` | 882 | app hydration、row mapping、payload builder、所有 repository methods | P0 |
| `src/styles/overlays.css` | 842 | 多種 overlay、drawer 與層級 | P1 |
| `src/types.ts` | 698 | DB row、input、view model 與 app domain 型別 | P1 |
| `src/features/world/components/ChildGamePanel.tsx` | 600 | 商店、背包、設定、寵物、裝飾 mutation | P1 |

補充風險：

- `backups/pre-refactor-20260727-201013/` 位於 repository 內，會讓搜尋與 AI 判斷 owner 時看到第二套舊程式；它不是 runtime source。
- 大量測試以正規表示式檢查 source text。搬檔時容易出現「行為沒壞但 contract test 壞掉」，也可能在行為已壞時仍通過。
- CSS 同一 class 可在 state、theme 與 breakpoint 合法重複，不能只依重複次數批次刪除；必須沿用 `CSS_RULES.md` 的 selector-owner 流程。

## 3. 建議規模規則

以下是治理門檻，不是為了湊行數。拆分仍以單一責任、資料流、可測試性與 ownership 為準。

| 類型 | 目標 | 警示 | 新檔／完成重構後硬上限 |
| --- | ---: | ---: | ---: |
| React component／hook | 250 行內 | 300 行 | 400 行 |
| domain service／utility／repository | 250 行內 | 300 行 | 400 行 |
| runtime coordinator | 400 行內 | 500 行 | 600 行 |
| 單一函式 | 50 行內 | 80 行 | 需在 review 說明 |
| CSS owner 檔 | 不以行數單獨判定 | 800 行 | 必須有 section owner 清單與拆分計畫 |

過渡期採 ratchet，不要求一次把所有舊檔壓到上限：

1. 新檔不得超過硬上限。
2. 既有熱點列入 baseline allowlist，但不得增加行數或新增責任。
3. 每次 extraction 後同步下修該檔 baseline，不能回長。
4. barrel file 只做 re-export，不藏邏輯。
5. migration、生成檔、vendor、binary、asset metadata dump 與測試 fixture 可排除，但排除項要明列，不能使用寬泛 glob 掩蓋正式程式。

## 4. 目標 ownership

### 4.1 3D 世界

`prototype-world-runtime.ts` 最終只負責組裝與生命週期，建議拆成：

- `world/runtime/runtime-contracts.ts`：公開型別與 runtime API。
- `world/runtime/resource-lifecycle.ts`：GLTF abort、dispose、texture/material tracker。
- `world/runtime/scene-bootstrap.ts`：renderer、camera、light、terrain 與品質設定。
- `world/runtime/character-runtime.ts`：玩家與漫遊人物模型、動畫、貼地。
- `world/runtime/pet-runtime.ts`：寵物 actor collection、建立、更新與 hit target。
- `world/runtime/decoration-runtime.ts`：裝飾載入、替換、placement preview。
- `world/runtime/frame-loop.ts`：每幀順序與 scheduler；只依賴小型 controller API。
- `prototype-world-runtime.ts`：組裝上述 controller，目標低於 600 行。

`TerrainWorldLayer.tsx` 拆為 runtime bridge hook、placement controls、pet action menu、world action menu 與 status layer；元件不得直接複製 runtime domain logic。

### 4.2 Dashboard

- `ParentDashboard.tsx` 保留頁面組裝與路由狀態；task/reward/child-account/hero-menu 各自進 feature hook 與 section component。
- `ChildDashboard.tsx` 保留 active child、feature routing 與 page composition；adventure/audio/wishlist/game-placement/pet-action 各自有 hook 或 feature controller。
- 抽取前先列出 state owner 與 callback consumer，避免將一個巨型 component 改成「巨型 props drilling」。跨區域狀態才進 reducer/context，區域狀態留在區域元件。

### 4.3 Store、資料存取與型別

- `store.tsx` 拆成 provider shell、state reducer/selectors，以及 family、task、adventure、game domain actions。
- `data-access.ts` 拆成 hydration、row mappers、payload builders 與各 domain repository；Supabase client 與錯誤轉譯維持共用基礎層。
- `types.ts` 按 `database rows`、`write inputs`、`domain/view models` 分檔，舊入口暫時 re-export，消費端逐步改成直接 domain import。
- 禁止造成 domain 反向依賴 UI；用 `dependency-cruiser` 類工具前先確認是否需要新增依賴，第一階段可用自製 import-boundary script。

### 4.4 CSS

先產生 selector-owner 與 breakpoint 報告，再依 `CSS_RULES.md` 拆分。拆分後仍由 `src/styles/index.css` 明確控制 import order；不得把舊規則留著再加 override。CSS 檔名按頁面／元件責任命名，不按「fix」「final」「override」命名。

## 5. 執行階段

### Phase 0：鎖定基線

- 記錄 `wc -l`、import/export、測試與 bundle 基線。
- 執行 `npm run lint`、`npm test`、`npm run build`、`npm run security:check`、`git diff --check`。
- 目前已知基線：`npm run lint` 通過；`npm test` 為 681 項中 680 通過，Nibus `modelBytes` contract 失敗。先把它記為既有失敗，不得把其他新失敗混入重構。
- 對 P0 檔新增 characterization tests，涵蓋公開輸出、重要 state transition、dispose、optimistic rollback 與 runtime update；優先把 source-regex test 改成行為／API contract test。

### Phase 1：建立治理文件與自動檢查

- 新增單一 `docs/code-maintainability.md`，記錄上限、例外、ownership、依賴方向與拆分 checklist；`AGENTS.md` 只放連結與必讀指令，不複製整份規格。
- 新增 `scripts/check-source-size.mjs` 與有理由的 baseline allowlist。
- `package.json` 新增 `quality:structure`，並接到 `verify`。輸出需列出檔案、目前行數、上限與修正提示。
- 新增 import boundary 檢查：`features/*` 不得依賴 dashboard 頁面，`lib` 不得依賴 components，runtime pure logic 不得依賴 React。

### Phase 2：先拆 3D runtime

- 按 4.1 的順序逐個 extraction；一次只搬一種責任。
- 每次搬移都先新增或調整 test，再移動實作；公開 API 由原入口 re-export，避免大爆炸式改 import。
- 不在這一階段調整寵物尺寸、貼地、陰影或跟隨演算法；相關行為由 Plan 17 處理。
- 每個 PR／AI 任務結束時，原 runtime 必須縮短且沒有新增 forwarding-only 的重複邏輯。

### Phase 3：拆 Dashboard 與 UI controller

- Parent 與 Child 分開執行，不能同一批同時大搬。
- 先抽 pure selectors／formatters，再抽 mutation controller hook，最後抽 section component。
- 每一步驗證 keyboard focus、modal close、loading/error、optimistic update 與 mobile layout；若改 CSS，執行 `CSS_RULES.md` 的完整 viewport 與 computed-style 流程。

### Phase 4：拆 Store、data access 與 types

- 先建立 domain facade，再搬實作；不要讓 UI 同時知道舊 repository 與新 repository。
- 保留 RPC 名稱、payload、row mapping、error translation 與 revision/idempotency 行為。
- 每個 domain 可獨立測試，且不需啟動 React app 或連 production Supabase。

### Phase 5：CSS ownership 整理

- 以 selector-owner 報告逐區處理 `modals.css`、`character.css`、`world.css`、`overlays.css`。
- 同一 selector 的 layout、theme、state 若必須分層，文件要指明各層 owner；否則合併回唯一 owner。
- 每次只處理一個 visual surface，禁止整包格式化造成不可 review 的 diff。

### Phase 6：清理與持續治理

- 確認 `backups/pre-refactor-20260727-201013/` 是否仍需版本控制。若只作備份，先取得使用者確認後移出 repository 或以單一 archive/tag 保留；未確認前不得刪除。
- 將結構檢查接到 CI，移除已完成的 allowlist 項。
- 更新 `plans/HANDOFF-STATUS.md`，列出尚未達標的舊檔，不得宣稱全案完成。

## 6. 任務切分與依賴

建議一個 AI／PR 只擁有一列，避免共改核心檔：

| 任務 | 擁有範圍 | 依賴 |
| --- | --- | --- |
| M1 | 維護規格、line/import checks | Phase 0 |
| M2 | runtime resource + scene bootstrap | M1 |
| M3 | character + pet + decoration runtime extraction | M2；寵物行為改動另依 Plan 17 |
| M4 | frame loop + coordinator 收斂 | M3 |
| M5 | ParentDashboard | M1 |
| M6 | ChildDashboard + Terrain UI | M1；與 M3 不同時修改 shared runtime contract |
| M7 | store + data access + types | M1，且 M5/M6 先鎖 facade |
| M8 | CSS owners | 對應 UI extraction 完成後 |
| M9 | backup／allowlist／handoff 收尾 | M2–M8 |

## 7. 驗收條件

- 新檔與完成重構的檔案符合第 3 節；所有超限舊檔都有 baseline、owner、理由與下一步。
- `prototype-world-runtime.ts` 不再同時實作模型工廠、pet collection、decoration collection、資源清理與完整 frame loop。
- Parent／Child dashboard 只做頁面組裝；任一 feature 可從獨立檔案找到 state、actions 與 tests。
- `store.tsx`、`data-access.ts`、`types.ts` 有清楚 domain boundary，沒有循環依賴。
- CSS 沒有新增 override 區塊、無理由 `!important` 或新 breakpoint。
- 行為測試取代關鍵 source-regex contract；必要的 source contract 只檢查真正的安全／架構 invariants。
- `npm run lint`、`npm test`、`npm run build`、`npm run security:check`、`npm run quality:structure`、`git diff --check` 全通過。
- 最終 handoff 列出每個熱點的重構前後行數、移出的責任、測試證據與仍存在的風險。

## 8. 禁止事項

- 不以刪空行、壓縮 JSX 或合併多個 statement 假裝改善行數。
- 不做一次性全案搬檔或全案格式化。
- 不在結構重構中順便改 UI、資料表、RPC、寵物動作或資產 tuning。
- 不建立 `utils2.ts`、`helpers.ts`、`common.ts` 等無 owner 的雜物檔。
- 不刪除 user changes、backup 或歷史 migration；破壞性清理需另行確認。
