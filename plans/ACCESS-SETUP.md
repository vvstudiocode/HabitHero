# 外部權限交接說明

## 結論

是的。完成以下登入/連接後，其他 AI agent 才能在授權範圍內執行 GitHub、Supabase、Vercel 的後續工作。權限必須透過官方連接器或本機 CLI 登入，不要把 token、密碼、service-role key 貼到對話或 commit。

目前三項登入已完成；詳見 [HANDOFF-STATUS.md](HANDOFF-STATUS.md)。

## 需要提供的不是秘密內容，而是已登入的權限

| 系統 | 需要的權限 | 用途 |
|---|---|---|
| GitHub | 已完成；repository remote 已設定 | `vvstudiocode/HabitHero`；建 branch、commit、PR、檢查 CI；是否 push/merge 仍由你明確授權 |
| Supabase | 已完成；本地已 link project | `HabitHero` / `rqofqnoyxnmlsuejeyld`；可進行 runtime 驗證，但 migration 尚未套用 |
| Vercel | 已完成 CLI 登入；project 尚未 link | 設定 env、建立 preview、production deploy、查看 logs |
| Apple/Google | Developer/App Store Console 帳號 | 第 10 點原生建置、簽名、測試與上架 |

## 連接後先做的只讀檢查

1. 確認 GitHub repository、default branch 與工作分支。
2. 確認 Supabase project ref、migration history、Auth redirect 設定與 Data API exposure。
3. 確認 Vercel project、team、preview/production environment 與 domain。
4. 先跑 runtime smoke test，不直接套 production migration 或 production deploy。

## 安全規則

- 前端與 mobile app 只能使用 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`。
- `service_role`/secret key 不得出現在 `src/`、bundle、GitHub、Vercel public env 或 app binary。
- GitHub Actions secrets、Vercel private env、Supabase CLI session 不寫入 repository。
- 任何 push、merge、production deploy、App Store submit 都要由使用者明確授權。
