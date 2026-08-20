# HabitHero 程式碼可維護性與模組邊界規格

本文件是 TypeScript、React、domain module 與 CSS 檔案規模治理的執行規格。它補充 `CSS_RULES.md`，不取代 CSS 的 selector owner 與 cascade 規則；也不授權為了降低行數而改變產品行為。

## 0. 目前執行快照

截至 Plan 16 最新程式快照 `b050359`，低風險 pure/mechanical extraction 已落地並各自有 test/refactor commit：

- world：`world-data-access.ts`、`world-runtime-geometry.ts`、`world-runtime-resources.ts`、`world-runtime-assets.ts`。
- data access：growth、child-account、child row、task/template、point-ledger payload/result owners；`data-access.ts` 保留相容 facade。
- store：`app-state-patches.ts` 與 `task-timer-state.ts` 保留 optimistic task-id、timer snapshot、timer transition 與 pure state patch helper facade。
- dashboard/world UI derivation：`parent-reward-grouping.ts`、`world-scene-key.ts`，不持有 React lifecycle 或 runtime side effects。
- types：`types.ts` 是 type-only facade，row/input/view/legacy contracts 已分檔。

最新 ratchet：`prototype-world-runtime.ts` 2,648 行、`data-access.ts` 679 行、`store.tsx` 936 行、`ParentDashboard.tsx` 1,875 行、`TerrainWorldLayer.tsx` 895 行、`types.ts` 11 行；完整 automated suite 727 tests / 78 suites。Dashboard/provider lifecycle、repository hydration、character/pet/frame-loop 與 CSS 尚未搬移，因為仍缺 browser/device/3D visual evidence；不得把 automated green 解讀為 visual gate 通過。

## 1. 執行範圍與安全邊界

- 目標是單一責任、可找到的 owner、可測試的邊界與可精準回退的變更，不是用刪空行或壓縮 JSX 湊行數。
- 目前已正常的功能、資料契約、RPC、錯誤文字、事件順序、寵物呈現與資產 metadata 都視為既有行為；重構前必須先有 characterization／contract evidence。
- `backups/`、`build/`、`dist/`、`node_modules/`、iOS／Android 產物、migration、binary 與 asset dump 不屬於本檢查的正式 source scope。
- `src/` 內的 `.ts`、`.tsx`、`.css` 會被 `npm run quality:structure` 掃描。檢查器只讀檔案，不會啟動 dev server、修改 source 或自動搬檔。
- 發現行為差異、無法解釋的 import 邊界違規、baseline 增長或基線測試失敗時，停止該階段並回報；不得以「應該不影響」略過。

## 2. 行數分級與 ratchet

行數以實際檔案的 newline 計算，與 `wc -l` 對齊。類型先按 runtime，再按 React component，再按一般 module 判定；CSS 仍由 `CSS_RULES.md` 管理責任與 cascade。

| 類型 | 目標 | 警示線 | 新檔／完成 extraction 的硬上限 |
| --- | ---: | ---: | ---: |
| React component／hook（`.tsx`） | 250 | 300 | 400 |
| domain service／utility／repository（一般 `.ts`） | 250 | 300 | 400 |
| runtime coordinator（`*runtime.ts` 或 `features/**/runtime/**`） | 400 | 500 | 600 |
| CSS owner | 由 selector owner 決定 | 800 | 不以行數單獨判定 |
| 單一函式 | 50 | 80 | review 必須說明例外 |

實際執行規則：

1. 未列入 baseline 的新檔不得超過硬上限；超過警示線但未超過硬上限時也應在加入前拆分或附 review 理由。
2. 已存在且超過警示／硬上限的檔案必須在檢查器的 baseline allowlist 內。allowlist 記錄當下行數，檔案不可回長；每次成功 extraction 後應把 baseline 下修。
3. baseline 不是永久豁免。檔案只要縮小，就保留較小數值；刪除或改名後要在同一個治理 commit 移除舊項目。
4. CSS 超過 800 行不會因行數直接阻擋，但必須有 owner、section 清單與後續拆分計畫；不得以新增 override 掩蓋責任衝突。
5. 新檔即使是 barrel file，也只能 re-export，不能藏 domain logic；不得建立沒有 owner 的 `utils2.ts`、`helpers.ts` 或 `common.ts`。

目前 baseline 的理由是「既有熱點尚未取得完整 regression／visual／device evidence，先禁止回長」；它們不是本階段自動拆分授權：

- 3D runtime／world：`src/features/world/prototype-world-runtime.ts`、`src/features/world/TerrainWorldLayer.tsx`。
- Dashboard／state／data contract：`src/components/ParentDashboard.tsx`、`src/components/ChildDashboard.tsx`、`src/store.tsx`、`src/lib/data-access.ts`。
- World feature／repository：`src/features/world/components/ChildGamePanel.tsx`、`src/lib/adventure-store-actions.ts`、`src/features/world/components/GameItem3DPreview.tsx`、`src/features/growth/components/GrowthSummaryPanel.tsx`、`src/features/world/world-roaming.ts`、`src/features/world/world-collision.ts`。
- Adventure components：`src/features/adventures/components/ParentAdventureWorkspace.tsx`、`src/features/adventures/components/AdventureRewardCelebration.tsx`。
- CSS owners：`src/styles/modals.css`、`src/styles/character.css`、`src/styles/world.css`、`src/styles/overlays.css`、`src/styles/neutral-theme.css`、`src/styles/login.css`、`src/styles/world-controls.css`、`src/styles/dashboard.css`。

allowlist 的精確行數以 `scripts/check-source-size.mjs` 為可執行來源；改動 allowlist 必須在 diff 說明檔案責任、目前 evidence 與下一步，不可為了讓 CI 綠燈任意放寬。

## 3. 依賴方向與 import boundary

第一階段使用無第三方依賴的 `scripts/check-import-boundaries.mjs`，只檢查可由 import path 判定的安全邊界：

| Importer | 禁止依賴 | 原因 |
| --- | --- | --- |
| `src/features/**` | `src/components/ParentDashboard.tsx`、`src/components/ChildDashboard.tsx` | feature 不得反向依賴頁面組裝與 dashboard lifecycle |
| `src/lib/**` | `src/components/**` | domain／data layer 不得反向依賴 React UI |
| pure runtime（`src/features/**/runtime/**` 或 `*runtime.ts`） | `react`、`react-dom`、React JSX runtime，或 `.tsx` module | runtime pure logic 不得持有 UI framework side effect |

相反方向（page → feature、UI → lib、coordinator → controller）可行，但不代表可以把整個 dashboard state 透過巨型 props drilling 傳下去；仍須在 extraction plan 裡寫明 state owner、consumer 與測試。

暫不執行模糊的「所有 feature 都不得 import components」規則，因為目前已有共用 `PointValue`、`TaipeiTimeInput`、modal shell 等合法 UI leaf import。若未來要收緊，先建立替代 shared boundary 與 characterization evidence，再另開任務。

## 4. Owner map

| 區域 | Canonical owner | 第一階段動作 |
| --- | --- | --- |
| 3D world | `src/features/world/`；coordinator 只組裝 lifecycle、controller 與 frame order | 只加 boundary／size report；不搬 pet、character、decoration 或 animation code |
| Parent dashboard | `src/components/ParentDashboard.tsx` 與 `src/components/parent-dashboard/` | 先列 state owner／callback consumer；沒有 evidence 不拆 |
| Child dashboard | `src/components/ChildDashboard.tsx` 與對應 feature components | 同上；不得和 runtime extraction 同一 commit |
| Store | `src/store.tsx` 與未來 domain reducer/selectors | 保留 realtime、offline、optimistic rollback 的 event order |
| Data access | `src/lib/data-access.ts` 與 domain repository | 保留 RPC、payload、mapping、error translation、revision/idempotency |
| Types | `src/types.ts` 及未來 domain type files | 舊入口先 re-export；禁止 UI 反向成為 domain type owner |
| CSS | 依 `CSS_RULES.md` 的單一 selector owner | 未取得 browser QA 與 screenshot baseline 前只產報告，不搬 selector |
| Pet asset process | `docs/pet-system.md`（由 Plan 17 管理） | Plan 16 不修改寵物 runtime、GLB、metadata 或 migrations |

## 5. 每次 extraction 的 checklist

### Before

- [ ] `git status --short --branch`、HEAD、remote checkpoint 已記錄，未提交變更已辨識。
- [ ] `BEHAVIOR-BASELINE.md` 有該熱點的操作前置、輸入／輸出、side effect、錯誤、event order 與 visual／device 缺口。
- [ ] 舊實作上的 characterization／contract tests 先通過；若基線失敗，先開獨立修正 commit。
- [ ] 已列出 state owner、import graph、公開 exports、dispose／cleanup 與回退 commit。
- [ ] 沒有把 CSS、UI redesign、bug fix、RPC／migration 或 pet tuning 混進結構變更。

### Change

- [ ] 一個 commit 只搬一種責任，優先原封不動搬移：不重命名、不改演算法、不改錯誤文字、不順手最佳化。
- [ ] 舊入口先保留 re-export／facade；消費端改 import 與刪舊實作分開 commit。
- [ ] 新檔符合硬上限；既有檔案不超過 baseline。
- [ ] pure logic 優先以 shadow comparison 比較新舊結果；有副作用的 RPC、音效、通知、DOM、renderer 與 AnimationMixer 不得執行兩次。

### After

- [ ] 該模組 tests、完整 `npm test`、`npm run lint`、`npm run build`、`npm run security:check`、`npm run quality:structure`、`git diff --check` 都有 exit code 記錄。
- [ ] 行為、資料 payload、錯誤轉譯、event order、animation／ground／shadow／follow 狀態與資源 dispose 都能用 evidence 解釋。
- [ ] browser／device／3D screenshot evidence 未授權時，標記為未驗證，不得宣稱通過。
- [ ] commit 可單獨發布，且能以 `git revert <commit>` 精準撤銷；不對 shared branch reset、rebase 或 force push。

## 6. 指令與停止閘門

Phase 1 只做治理，不搬程式：

```bash
npm run quality:structure
npm run lint
npm test
npm run build
npm run security:check
git diff --check
```

`npm run quality:structure` 失敗時會列出違規檔案、目前行數、警示／硬上限、baseline 與修正提示；它不會自動改檔。既有 Nibus `modelBytes` assertion 若仍失敗，屬 asset metadata／test expectation 基線問題，必須單獨記錄與核對，不能在本治理檢查中重匯 GLB、改 runtime 呈現或改寫 migration history。

沒有完整 baseline、browser/device 授權或精準 revert 方法時，下一階段維持 blocked；可繼續補文件與唯讀報告，但不得開始高風險 extraction。Plan 17 的寵物五個 FBX 整合是另一份 docs-only canonical process，不能被解讀為修改現有寵物。

## 7. Review 回報格式

```md
## Scope
- Hotspot / responsibility:
- Baseline commit / branch:

## Evidence
- Automated commands and exit codes:
- Behavior / visual / device evidence:
- Missing evidence:

## Change
- Commit:
- Files:
- Before / after lines:
- Behavior intentionally changed: none

## Rollback
- Exact commit to revert:
- External state changed: no

## Result
- Pass / stopped / reverted:
- Remaining risk:
- Approval needed for next step:
```
