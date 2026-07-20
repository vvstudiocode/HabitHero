# 08 測試、安全與交付前驗收

## 目標

在進入第 9 點 Web 部署與第 10 點雙平台上架前，證明前 7 點的功能、資料隔離、錯誤處理與基本可用性達標。

## 依賴

01-07 全部完成。

## 允許修改

- 測試設定與測試檔
- `src/` 中為修正驗收問題所需的小範圍修改
- `supabase/` 測試/seed 的小範圍修改
- `plans/08-quality-security/`

## 驗收矩陣

- Auth：註冊、登入、刷新、登出、錯誤與 session 過期。
- RLS：匿名、跨家庭 parent、child 越權查詢與 mutation 全部拒絕。
- Domain：建立任務、孩子提交、家長核准、點數入帳、獎勵兌換、重複操作。
- Sync：兩個 session 的更新、斷線、恢復與訂閱清理。
- UI：loading/error/empty/disabled、鍵盤基本操作、窄手機 viewport、不重疊與不洩漏敏感錯誤。
- Build：`npm run lint`、`npm run build`，並在可用環境執行單元/整合/E2E。

## 安全門檻

- 不提交 `.env`、token、service-role key、真實兒童資料。
- 所有 exposed tables 有 RLS；政策使用 ownership predicate。
- 前端不接受 client 傳入的 role 作授權依據。
- 兒童帳號、家長同意、隱私政策、刪除帳號與資料保存要求列為上架阻擋項，交由產品/法務確認。

## 交付

產生測試結果、風險清單、已知限制與「可進入 09」的 go/no-go 報告。未通過時不得派發 09/10。
