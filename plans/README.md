# HabitHero 建構任務索引

這份目錄是 HabitHero 從單機 localStorage 版本改造成多裝置產品的建構總控文件。

## 執行規則

- 每個編號資料夾是一個獨立子 agent 任務，子 agent 只能修改該任務允許的檔案。
- 子 agent 開始前必須讀 `plans/00-overview.md` 與自己的 `PLAN.md`。
- 子 agent 完成後必須回報：修改檔案、測試命令、測試結果、未完成項目與風險。
- 總指揮負責依依賴順序派工、審核 diff、驗收與處理跨任務整合。
- 第 9、10 點目前只保留規格，不執行部署或上架。
- 執行 16 的程式 extraction 前必須確認已 push checkpoint、全綠測試與 behavior baseline；沒有 visual/device evidence 的高風險區域只能盤點，不能宣稱重構完成。
- Plan 17 是 docs-only 任務，只建立未來五個 FBX 整合流程，不修改或修正現有寵物；它可在記錄既有測試基線後獨立執行。
- 16 的每個 extraction 與 17 的文件整併必須獨立 commit、獨立驗證、可用 `git revert` 精準撤銷；禁止在 shared branch reset 或 force push。
- browser QA、dev server、真機、遠端 migration、部署與上架仍需使用者另外明確批准，計畫文件本身不授權外部操作。

## 任務順序

| 編號 | 任務 | 狀態 | 依賴 |
|---|---|---|---|
| 01 | 共用資料契約與遷移邊界 | 已完成 | — |
| 02 | Supabase Auth 與身份流程 | 已完成，runtime 待驗證 | 01 |
| 03 | Supabase DB、Migration、RLS、RPC | 已完成，runtime 待驗證 | 01 |
| 04 | Supabase 資料存取層與 App Provider | 已完成 | 02, 03 |
| 05 | 家長端流程接入雲端資料 | 已完成，invite bootstrap 有限制 | 04 |
| 06 | 孩子端流程接入個人手機登入 | 已完成，runtime 待驗證 | 04 |
| 07 | 即時同步、重試與離線狀態 | 已完成，runtime 待驗證 | 05, 06 |
| 08 | 測試、安全與交付前驗收 | 已完成，NO-GO | 01-07 |
| 09 | Supabase Runtime 驗證 + Vercel Web 部署 | 可開始，尚未執行外部操作 | 08 |
| 10 | Capacitor iOS/Android 建置與雙平台上架 | 暫緩，等待 09 通過 | 08, 09 |
| 16 | [可維護性、模組邊界與檔案規模治理](./16-maintainability-and-module-boundaries/PLAN.md) | Phase 0/1 已執行並全綠；Phase 2+ 尚未開始，等待使用者選定單一 hotspot 與 evidence 授權 | checkpoint `b24a93f`；[BEHAVIOR-BASELINE](./16-maintainability-and-module-boundaries/BEHAVIOR-BASELINE.md) |
| 17 | [寵物五個 FBX 整合規則與單一文件](./17-pet-asset-runtime-consolidation/PLAN.md) | Docs-only 已執行完成；現有寵物正確，不修改程式／資產 | checkpoint `b24a93f`；canonical [`docs/pet-system.md`](../docs/pet-system.md) |

## 2026-08-20 實際執行結果

- Plan 16 Phase 0：branch、remote、checkpoint、automated baseline 已記錄；`npm run lint`、`npm test`（681/681）、`npm run build`、`npm run security:check`、`git diff --check` 全部通過。
- Plan 16 Phase 1：已加入 [`docs/code-maintainability.md`](../docs/code-maintainability.md)、`quality:structure`、source-size ratchet 與 import-boundary checks；沒有搬動任何產品程式。
- Plan 16 Phase 2–8：依計畫的 stop gate 尚未開始；未選定 hotspot、未取得 browser／device evidence 前不得宣稱完成 extraction。
- Plan 17：已完成唯一 [`docs/pet-system.md`](../docs/pet-system.md)，合併舊 multi-animation 文件、更新入口並移除重複文件；現有 pet runtime、GLB、exporter、metadata、migration、tests 與外部狀態均未改變。

## 16、17 的交接啟動順序

下一個 AI 不得跳步：

1. 讀 `AGENTS.md`、`CSS_RULES.md`、Plan 16 全文與 Plan 17 全文。
2. 重新確認 branch、remote、HEAD、working tree；`b24a93f` 只作已知總 checkpoint，不假設它仍是最新合格 baseline。
3. 若執行 Plan 16，先完成 Phase 0：若基線出現 Nibus bytes mismatch，只能在核對後修正過時的 assertion／文件資訊，不重匯或調整寵物；若測試已全綠，不做 Nibus 變更。兩種情況都必須讓 lint、test、build、security 與 diff check 全綠。
4. 若執行 Plan 16，建立 `BEHAVIOR-BASELINE.md`；Phase 1 只建立治理護欄，完成後停止回報，不得自動開始大規模 extraction。
5. 若只執行 Plan 17，記錄現有測試基線即可；若出現 Nibus bytes mismatch 也只作既有 observation，不在 docs-only 任務修改 test、migration 或 GLB。
6. Plan 17 先唯讀核對目前正確的 runtime、exporter、asset、tests 與舊文件，再建立唯一 `docs/pet-system.md`。
7. Plan 17 不建立寵物修正清單、不調整任何現有值，也不修改 runtime、exporter、GLB、migration 或 pet tests。
8. 文件內容完整合併後才刪除個別 multi-animation MD；任何無法判定的差異標示 unknown 並回報使用者。
9. 完成後依兩份 plan 各自的 handoff template 回報，不得自行啟動 dev server、部署、apply remote migration 或上架。

## 子 agent 通用交付格式

1. 先讀本任務 `PLAN.md`、`AGENTS.md` 與相依任務的輸出。
2. 只修改任務範圍內檔案；需要跨界修改時先回報總指揮。
3. 不新增 service-role key、明文密碼、兒童個資或生產資料。
4. 完成後執行任務文件列出的驗收命令。
5. 交付摘要必須包含 acceptance criteria 的逐項結果。
6. Plan 16 額外回報 behavior evidence 與 exact revert commit；Plan 17 額外聲明現有寵物、程式、資產、migration、tests 與外部狀態均未改變。
