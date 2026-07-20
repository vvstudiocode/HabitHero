# 09 Supabase Runtime 驗證與 Vercel Web 部署

**狀態：** 暫緩，前置是使用者完成 GitHub、Supabase、Vercel 登入並明確授權外部操作。

## 交給其他 AI 的起點

從 `plans/09-vercel-supabase-deployment/PLAN.md` 開始，先讀 `plans/00-overview.md`、`plans/08-quality-security/GO-NO-GO.md` 與 [ACCESS-SETUP.md](../ACCESS-SETUP.md)。不要從 10 開始。

## 依賴

- 前 8 點程式碼已完成。
- GitHub repository 可讀寫，但 push/merge 仍須明確授權。
- Supabase test/staging project 已登入；不先對 production 做 migration。
- Vercel project/team 已登入；Web env 尚未盲設。

## 執行順序

1. **Runtime database gate**：確認 CLI/MCP 身份、project ref、migration history；建立 staging backup/rollback 方案。
2. 套用 migration，執行 advisors、schema 檢查、RLS allow/deny matrix。
3. 建立至少兩個家庭、parent/child 測試帳號，驗證 invite、過期、撤銷、replay、跨家庭拒絕、approve/redeem concurrency。
4. 用兩個 authenticated sessions 驗證 Realtime、refresh、logout、session switch、offline/reconnect。
5. 修正問題後重跑 `npm run security:check`、`npm run lint`、`npm run build`。
6. 在 Vercel 設定 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`；不要設定 service-role key。
7. 設定 Supabase Auth redirect URLs：localhost、Vercel preview、production domain；確認 Site URL。
8. 建立 preview deployment，跑 browser smoke test；通過後才申請 production deploy。
9. 產出 deployment URL、commit SHA、migration version、env scope、logs 與 rollback plan。

## Required Acceptance Criteria

- AC-09-01：staging migration 可重複套用且 schema history 一致。
- AC-09-02：匿名、跨家庭 parent、child 越權的實際 DB 測試全部拒絕。
- AC-09-03：invite、approve、redeem 的過期、重放、並發與 rollback 測試通過。
- AC-09-04：Vercel preview 可完成 parent/child Web workflow，refresh/logout 不洩漏資料。
- AC-09-05：production deploy 前沒有 secrets 進 bundle；所有 build/security checks 通過。

## 停止條件

- 沒有 Supabase runtime credentials 或測試帳號：停止，不可宣稱部署安全。
- RLS/RPC 任一 required test 失敗：停止，不進 Vercel production。
- 需要 push、merge 或 production deploy：先回報並取得使用者明確授權。
