# HabitHero 可維護性、模組邊界與檔案規模治理計畫

## 1. 任務目的

本任務先建立安全護欄與既有行為證據，再做有條件、可回退的等價重構；不改產品流程、畫面、資料契約或 Supabase 行為。完成後，新的 AI 能從清楚的模組 owner、入口與測試理解專案，不需要在數千行檔案中修改彼此無關的功能。

執行前必讀：`AGENTS.md`、`CSS_RULES.md`、本文件，以及與修改範圍相關的既有 plan。開始前先執行 `git status --short`；現有未提交變更屬於使用者，不得覆寫、還原或順手整理。

### 1.1 安全原則與誠實邊界

任何 AI 都不能以「測試通過」保證所有裝置、所有時序與所有視覺細節永遠零錯誤。本計畫追求的是：先把目前正常行為變成可重複比較的證據，再讓每一步變更都能被阻擋、定位與精準回退。

- 行數下降不是主要成功指標；行為等價、責任清楚、證據完整才是。
- 沒有 regression baseline 的區域禁止重構。
- 無法解釋的差異就是失敗，不得以「應該沒影響」繼續下一步。
- 若建立足夠證據的成本高於當下維護收益，允許只加護欄並保留大檔案。
- 「全部完成」不代表強迫每個熱點拆到目標行數；代表所有已拆區域通過完整閘門，未拆區域被明確凍結、分配 owner 並禁止繼續增加責任。

## 2. 2026-08-20 盤點結論

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

### 2.1 已建立的 Git 恢復點

2026-08-20 已確認：

- branch：`codex/deploy-all-worktree`
- remote tracking branch：`origin/codex/deploy-all-worktree`
- 重構前已 push checkpoint：`b24a93f`（commit subject：`“codexainewok16“`）
- 檢查當下 local 與 remote 指向同一 commit，working tree 為 clean。

`b24a93f` 是 repository 檔案的恢復參考，不是資料庫、遠端服務或使用者裝置資料的備份。本任務禁止修改 production Supabase、部署、上架或第三方資源，因此正常情況下不需要處理外部狀態回滾。

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

## 4. 功能等價定義與驗收矩陣

重構前先建立 `plans/16-maintainability-and-module-boundaries/BEHAVIOR-BASELINE.md`。它是逐步勾選的驗收紀錄，不得只寫「看起來正常」。至少包含：

| 領域 | 必須保存的行為證據 |
| --- | --- |
| Auth／身份 | 家長登入、孩子登入、登出、session refresh、切換孩子、權限錯誤 |
| 家長流程 | 新增／編輯／刪除任務、核准、退回、獎勵、點數、孩子帳號與設定 |
| 孩子流程 | 今日／一般冒險、計時、完成回報、願望、兌換、通知與錯誤狀態 |
| 資料同步 | realtime、foreground refresh、offline、retry、optimistic update、rollback、revision/idempotency |
| 遊戲經濟 | 商店、背包、購買、裝備、寵物、裝飾放置／移動／收回 |
| 3D 人物／寵物 | Idle、Walk、停止、轉向、跟隨順序、巡遊、互動、貼地、陰影、名稱、high/low quality |
| UI／CSS | modal、drawer、overlay、keyboard focus、touch、safe area、375x709、1440x900、reduced motion |
| 音訊／通知 | 背景音樂、完成音效、切換頁面後停止、push preference |
| 平台 | Web；需要發佈 mobile 時再加入 iOS／Android 真機，不用 Web 結果代替 mobile |

每一列都記錄：操作前置條件、步驟、預期、automated evidence、manual evidence、viewport/device、日期、執行者、結果與 artifact path。未涵蓋的流程不得宣稱已完成等價驗證。

### 4.1 Golden baseline

在搬動程式前保存：

- 關鍵流程的行為／API contract tests，不只用 regex 檢查 source text。
- 固定 viewport 的 before screenshots；畫面有動畫時另保存穩定狀態或遮罩規則。
- 3D 固定場景的 actor position、rotation、scale、animation state、ground offset、shadow/marker state 與 follow order snapshot。
- Supabase repository 的 RPC 名稱、payload、回傳 mapping、error translation 與 mutation event order。
- build 結果、主要 chunk size、3D FPS／frame budget 與 dispose 後資源狀態。

依 `AGENTS.md`，不得自行啟動 dev server。需要 browser QA、錄影或真機操作時，先取得使用者明確同意；沒有同意就停在 automated evidence，不得宣稱 visual/device gate 通過。

### 4.2 全綠前置條件

任何 extraction 開始前必須：

1. 以獨立 commit 修正所有已知基線失敗，不能和重構混在一起。
2. `npm run lint`、`npm test`、`npm run build`、`npm run security:check`、`git diff --check` 全部 exit 0。
3. 若基線出現 Nibus `modelBytes` mismatch，先核對實際 GLB bytes、migration 與 test；只有在確認 assertion／文件資訊過時時，才可修正該 assertion／文件 expectation。現有寵物呈現已由使用者確認正確，不得重匯 GLB、修改 runtime 呈現、調整 metadata 數值或改寫已發布 migration history。若基線已全綠，Nibus 不做任何變更。
4. baseline 修正後重新記錄完整測試數量與結果。
5. browser/device evidence 所需授權未取得時，該熱點保持 blocked for extraction，但可以先做不搬碼的治理文件與檢查器。

## 5. 目標 ownership

### 5.1 3D 世界

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

### 5.2 Dashboard

- `ParentDashboard.tsx` 保留頁面組裝與路由狀態；task/reward/child-account/hero-menu 各自進 feature hook 與 section component。
- `ChildDashboard.tsx` 保留 active child、feature routing 與 page composition；adventure/audio/wishlist/game-placement/pet-action 各自有 hook 或 feature controller。
- 抽取前先列出 state owner 與 callback consumer，避免將一個巨型 component 改成「巨型 props drilling」。跨區域狀態才進 reducer/context，區域狀態留在區域元件。

### 5.3 Store、資料存取與型別

- `store.tsx` 拆成 provider shell、state reducer/selectors，以及 family、task、adventure、game domain actions。
- `data-access.ts` 拆成 hydration、row mappers、payload builders 與各 domain repository；Supabase client 與錯誤轉譯維持共用基礎層。
- `types.ts` 按 `database rows`、`write inputs`、`domain/view models` 分檔，舊入口暫時 re-export，消費端逐步改成直接 domain import。
- 禁止造成 domain 反向依賴 UI；用 `dependency-cruiser` 類工具前先確認是否需要新增依賴，第一階段可用自製 import-boundary script。

### 5.4 CSS

先產生 selector-owner 與 breakpoint 報告，再依 `CSS_RULES.md` 拆分。拆分後仍由 `src/styles/index.css` 明確控制 import order；不得把舊規則留著再加 override。CSS 檔名按頁面／元件責任命名，不按「fix」「final」「override」命名。

## 6. 執行階段與停止閘門

### Phase 0：確認 checkpoint 與全綠基線

- 從最新已驗證的 planning commit 建立新的短期分支；`b24a93f` 保留為重構前恢復參考，不要直接在舊 checkpoint 上累積一個巨大重構。
- 記錄 HEAD、remote branch、`wc -l`、import/export、測試、bundle 與行為基線。
- 執行 `npm run lint`、`npm test`、`npm run build`、`npm run security:check`、`git diff --check`。
- 若確有 Nibus 基線 mismatch，修正後才能進 Phase 2；修正 commit 只處理過時 assertion／文件資訊，不得改變模型或產品呈現。若 baseline 全綠，直接保留證據並進入下一個 gate。
- 建立 `BEHAVIOR-BASELINE.md`，列出已覆蓋與尚未覆蓋項目。
- 任一基線命令失敗、working tree 含不明變更或 remote checkpoint 無法確認：停止，不開始搬碼。

### Phase 1：只建立治理護欄，不搬程式

- 新增單一 `docs/code-maintainability.md`，記錄上限、例外、ownership、依賴方向與拆分 checklist；`AGENTS.md` 只放連結與必讀指令，不複製整份規格。
- 新增 `scripts/check-source-size.mjs` 與有理由的 baseline allowlist。
- `package.json` 新增 `quality:structure`，並接到 `verify`。輸出需列出檔案、目前行數、上限與修正提示。
- 新增 import boundary 檢查：`features/*` 不得依賴 dashboard 頁面，`lib` 不得依賴 components，runtime pure logic 不得依賴 React。
- 這一階段不得搬函式、拆 component、改 import path、改 CSS selector 或調整 runtime。
- Phase 1 可獨立完成並發布。完成後先停下回報，使用者未批准目標熱點前，不自動進 Phase 2。

### Phase 2：為一個熱點補足 regression evidence

- 一次只選一個熱點；先以 `BEHAVIOR-BASELINE.md` 建立該熱點的 automated/manual evidence。
- 對公開輸出、重要 state transition、dispose、optimistic rollback、runtime update、keyboard/touch 與視覺狀態新增 characterization tests。
- 優先把關鍵 source-regex tests 改成行為／API contract；真正的安全 invariant 才保留 source check。
- baseline tests 必須在未搬碼的舊實作上先通過，避免寫出只符合新架構的自我驗證測試。
- 未完成該熱點的行為矩陣、visual/device evidence 或無法重現現況：停止，該熱點只套 ratchet，不重構。

### Phase 3：單一責任機械式 extraction

每個 extraction 必須遵守：

1. 一個 commit 只搬一種責任，理想 review diff 小於 500 行；純搬移造成的 delete/add 可例外，但語意變更仍必須極小。
2. 第一輪原封不動搬移：不重新命名、不改參數、不改演算法、不最佳化、不改錯誤文字、不改 CSS、不順便修 bug。
3. 舊公開入口先 re-export 或呼叫新模組，消費端 import 分開在後續 commit 漸進修改。
4. 搬移後立即執行該模組 tests、完整 tests、lint、build、security 與 diff check。
5. 執行該熱點的 before/after 行為、視覺、時序與效能比較。
6. 任一差異無法由「只有檔案位置改變」解釋時，停止並 revert 這一個 commit。
7. 該 commit 被確認可獨立發布後，才能開始下一個 extraction。

禁止將「搬移」「重新設計」「bug fix」放在同一 commit。發現舊 bug時先記錄，等結構重構完成後另開 fix 任務。

### Phase 4：Shadow comparison

對無副作用的 pure logic，先讓新舊實作在 test／development path 對相同輸入計算：

```ts
const oldResult = oldImplementation(input);
const newResult = newImplementation(input);
assertEquivalent(newResult, oldResult);
return oldResult;
```

- 適用：selectors、formatters、payload mapping、row mapping、collision、following target、scale metrics、state transition plan。
- 不適用：RPC、寫入、音效、通知、DOM mutation、AnimationMixer、renderer 或任何有副作用操作，避免執行兩次。
- 有副作用時比較「預計執行的 command/event plan」或序列化結果，不執行第二次外部動作。
- 收集足夠等價案例後才切換 owner；切換與刪除舊實作分成兩個 commit，方便回退。

### Phase 5：依低風險到高風險拆分

執行順序固定為：

1. 純型別、常數、formatters。
2. 無副作用 selectors、payload builders、row mappers。
3. repository domain facade；保留 RPC、payload、error translation、revision/idempotency。
4. 單一 UI 顯示 section。
5. Dashboard controller hooks；Parent 與 Child 分開。
6. `store.tsx` actions／reducer；realtime、offline、optimistic update 分開。
7. 3D resource lifecycle、scene bootstrap。
8. character／pet／decoration controller。
9. frame loop、AnimationMixer、follow order 與 runtime 時序最後處理。

寵物尺寸、貼地、陰影、動作或跟隨演算法不屬 Plan 16。Plan 17 只建立未來五個 FBX 整合的 canonical 文件，也不修改現有寵物；若未來確認產品問題，必須另開經使用者批准的修正計畫。

### Phase 6：CSS 專用閘門

- 以 selector-owner 報告逐區處理 `modals.css`、`character.css`、`world.css`、`overlays.css`。
- 一個 visual surface 一個任務；不得同時改 layout、theme 與 interaction behavior。
- 修改前後比較 375x709、1440x900、default、hover、pressed、selected、focus、reduced motion 與 computed style。
- 嚴格執行 `CSS_RULES.md`；不得保留舊規則再追加 override，也不得整包格式化。
- 沒有 browser QA 授權或 screenshot baseline 時，CSS 只做 owner 報告，不搬規則。

### Phase 7：全故事驗證與觀察期

- 每個熱點完成後重跑第 4 節完整矩陣，而不是只跑該模組 tests。
- Web 完整 journey：登入 → 核心家長流程 → 切孩子 → 核心孩子流程 → 商店／寵物／佈置 → logout/login recovery。
- 若本次準備 mobile release，依 `AGENTS.md` 先驗證 Supabase production publishable key，再 `npm run cap:sync`；iOS／Android 真機結果分開記錄。
- 比較 console error、unhandled rejection、WebGL context、資源 dispose、FPS、主要 bundle chunk 與記憶體趨勢。
- 結構重構完成後至少保留一個只做驗證／修復的穩定期，不在同一批加入新功能或視覺改版。
- 任何 release、deployment、remote migration 或上架仍需使用者另行明確核准；本計畫本身不授權外部變更。

### Phase 8：清理與持續治理

- 確認 `backups/pre-refactor-20260727-201013/` 是否仍需版本控制。若只作備份，先取得使用者確認後移出 repository 或以單一 archive/tag 保留；未確認前不得刪除。
- 將結構檢查接到 CI，移除已完成的 allowlist 項。
- 更新 `plans/HANDOFF-STATUS.md`，列出尚未達標的舊檔，不得宣稱全案完成。

## 7. Git 提交與精準回退規則

### 7.1 每一步提交

- 開始任務時記錄 `git rev-parse HEAD` 與 `git status --short --branch`。
- 每一個 extraction 一個 commit；建議訊息：`refactor(<scope>): extract <single responsibility>`。
- 測試補強使用獨立 `test(<scope>): capture existing <behavior>` commit。
- 治理文件／檢查器使用獨立 `docs:`／`chore(quality):` commit。
- 不使用 `git add .` 把不相關變更一起收入；先 `git diff`，再 stage 明確檔案或使用 `git add -p`。
- push 前記錄完整 verification result；push 不代表驗證完成，只代表建立遠端可恢復歷史。

### 7.2 發現錯誤時

- 尚未 commit：停止後續工作，列出差異；任何會丟棄使用者修改的 restore 操作先取得確認。
- 已 commit、尚未共享：可建立修正 commit；不要為了漂亮歷史冒險丟資料。
- 已 push／其他人可能已基於該 commit 工作：使用 `git revert <bad-commit>` 建立反向 commit，再重新驗證與 push。
- 多個錯誤 commit：依反向順序逐個 revert，保持每一步可審查；merge commit 需確認 parent，不可猜 `-m`。
- 禁止對 shared branch 使用 `git reset --hard`、rebase public history 或 `git push --force`。
- Git revert 只能恢復 Git 追蹤的檔案；資料庫 migration、部署、上架、第三方寫入、未追蹤檔與使用者資料需要各自的復原方案。因此本結構計畫禁止這些外部 mutation。

### 7.3 恢復到重構前 checkpoint

若需要撤銷所有 Plan 16 後續 commit，先用下列唯讀命令確認範圍：

```bash
git log --oneline b24a93f..HEAD
git diff --stat b24a93f..HEAD
```

再由人確認要逐個 revert 哪些 commit。不要直接 reset 到 `b24a93f`；shared remote 使用 revert history 才不會破壞其他人的工作。

## 8. 任務切分與依賴

建議一個 AI／PR 只擁有一列，避免共改核心檔：

| 任務 | 擁有範圍 | 依賴 |
| --- | --- | --- |
| M0 | 修正基線、行為矩陣、golden evidence | checkpoint 已確認；未完成不得 extraction |
| M1 | 維護規格、line/import checks；不搬碼 | M0 automated baseline |
| M2 | 純型別、selectors、mappers | M0；各自 regression evidence |
| M3 | ParentDashboard | M0/M1；Parent visual/interaction evidence |
| M4 | ChildDashboard + Terrain UI | M0/M1；Child visual/interaction evidence；不與 runtime 共改 |
| M5 | store + data access | M0/M1；sync/offline/rollback evidence，先鎖 facade |
| M6 | runtime resource + scene bootstrap | M0/M1；3D dispose/performance evidence |
| M7 | character + pet + decoration controller extraction | M6；只允許 Plan 16 等價搬移，Plan 17 僅供文件規則參考，不授權寵物行為改動 |
| M8 | frame loop + coordinator 收斂 | M7；完整 3D snapshot／visual gate |
| M9 | CSS owners | 對應 UI extraction 完成且取得 browser QA 授權 |
| M10 | 全矩陣驗證、backup／allowlist／handoff | M2–M9 中實際執行的任務 |

不得假設 M2–M9 全部必做。每個任務開始前由使用者或總指揮確認收益、evidence 與回退成本；不通過就保持 allowlist。

## 9. 每個 commit 的驗證清單

- [ ] Diff 只有單一責任，沒有順便修 bug／改 UI／改資料契約。
- [ ] 舊實作上的 characterization baseline 已先通過。
- [ ] 對應 unit／contract／integration tests 通過。
- [ ] `npm run lint`、`npm test`、`npm run build`、`npm run security:check`、`git diff --check` 通過。
- [ ] 若 Phase 1 已完成，`npm run quality:structure` 通過。
- [ ] before/after 行為、event order、錯誤文字與 side effects 相同。
- [ ] UI/3D/CSS 有授權時完成 screenshot、interaction、computed style 或固定場景比較；無授權不得勾選。
- [ ] 效能、bundle、dispose 沒有超過基線容許差異；差異有數據與理由。
- [ ] Commit 可單獨發布，也能以單一 revert 撤銷。
- [ ] Handoff 記錄 commit、命令、結果、artifacts、未驗證項與風險。

## 10. 最終驗收條件

- 新檔與完成重構的檔案符合第 3 節；所有超限舊檔都有 baseline、owner、理由與下一步。
- `prototype-world-runtime.ts` 不再同時實作模型工廠、pet collection、decoration collection、資源清理與完整 frame loop。
- Parent／Child dashboard 只做頁面組裝；任一 feature 可從獨立檔案找到 state、actions 與 tests。
- `store.tsx`、`data-access.ts`、`types.ts` 有清楚 domain boundary，沒有循環依賴。
- CSS 沒有新增 override 區塊、無理由 `!important` 或新 breakpoint。
- 行為測試取代關鍵 source-regex contract；必要的 source contract 只檢查真正的安全／架構 invariants。
- `npm run lint`、`npm test`、`npm run build`、`npm run security:check`、`npm run quality:structure`、`git diff --check` 全通過。
- `BEHAVIOR-BASELINE.md` 的 in-scope 功能矩陣逐項有 before/after evidence；未驗證項清楚標為未完成，不能用 automated tests 代替真機／視覺結果。
- 每一個 extraction 都能對應一個獨立 commit、verification record 與 revert 方法。
- 最終 handoff 列出每個熱點的重構前後行數、移出的責任、測試證據、visual/device evidence、commit 與仍存在的風險。
- 使用者確認完成前，AI 不得自行將「計畫結束」等同於「產品零錯誤」。

## 11. 下一個 AI 的回報模板

```md
## Scope
- Hotspot / single responsibility:
- Baseline commit:
- Working branch:

## Before evidence
- Automated:
- Visual/device:
- Missing evidence:

## Change
- Commit:
- Files:
- Before/after line count:
- Behavior intentionally changed: none

## Verification
- Commands and exit codes:
- Behavior matrix rows:
- Screenshot/runtime artifacts:
- Performance/bundle comparison:

## Rollback
- Exact commit to revert:
- External state changed: no

## Result
- Pass / stopped / reverted:
- Remaining risk:
- Approval needed for next step:
```

## 12. 禁止事項

- 不以刪空行、壓縮 JSX 或合併多個 statement 假裝改善行數。
- 不做一次性全案搬檔或全案格式化。
- 不在結構重構中順便改 UI、資料表、RPC、寵物動作或資產 tuning。
- 不建立 `utils2.ts`、`helpers.ts`、`common.ts` 等無 owner 的雜物檔。
- 不刪除 user changes、backup 或歷史 migration；破壞性清理需另行確認。
- 不把「test pass」當成視覺、真機、時序與效能全部正確的替代證據。
- 不在沒有基線、沒有 browser/device 授權或沒有精準 revert commit 時處理高風險區域。
- 不在 shared remote branch reset、force push 或重寫已公開歷史。
