# HabitHero 建構任務索引

這份目錄是 HabitHero 從單機 localStorage 版本改造成多裝置產品的建構總控文件。

## 執行規則

- 每個編號資料夾是一個獨立子 agent 任務，子 agent 只能修改該任務允許的檔案。
- 子 agent 開始前必須讀 `plans/00-overview.md` 與自己的 `PLAN.md`。
- 子 agent 完成後必須回報：修改檔案、測試命令、測試結果、未完成項目與風險。
- 總指揮負責依依賴順序派工、審核 diff、驗收與處理跨任務整合。
- 第 9、10 點目前只保留規格，不執行部署或上架。

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

## 子 agent 通用交付格式

1. 先讀本任務 `PLAN.md`、`AGENTS.md` 與相依任務的輸出。
2. 只修改任務範圍內檔案；需要跨界修改時先回報總指揮。
3. 不新增 service-role key、明文密碼、兒童個資或生產資料。
4. 完成後執行任務文件列出的驗收命令。
5. 交付摘要必須包含 acceptance criteria 的逐項結果。
