# HabitHero AI 交接狀態

**更新日期：** 2026-07-20
**目前負責人：** 總指揮 agent
**下一個執行任務：** 09 Supabase Runtime 驗證與 Vercel Web 部署

## 已完成登入與本機連結

| 系統 | 狀態 | 已確認內容 |
|---|---|---|
| GitHub | 已登入、已設定 remote | `vvstudiocode/HabitHero`；本地 branch `main`；尚未 commit/push |
| Supabase | 已登入、已 link | project `HabitHero`；ref `rqofqnoyxnmlsuejeyld`；尚未套用遠端 migration |
| Vercel | 已登入 | CLI user `vvstudiocode`；尚未 link Vercel project、設定 env 或 deploy |

## 接手 AI 必讀順序

1. `AGENTS.md`
2. `plans/00-overview.md`
3. `plans/HANDOFF-STATUS.md`
4. `plans/08-quality-security/GO-NO-GO.md`
5. `plans/09-vercel-supabase-deployment/PLAN.md`
6. `plans/ACCESS-SETUP.md`

## 目前可以開始的工作

- 使用 Supabase staging/runtime 做 migration、RLS、RPC、Auth、invite、Realtime 驗證。
- 使用 Vercel project 設定 preview env，建立 preview deployment。
- 使用 GitHub 建立工作 branch、commit 與 draft PR，但 push 前仍需確認變更範圍。

## 尚未完成，禁止假設已完成

- Supabase migrations 尚未套用到遠端 HabitHero project。
- 尚未完成 authenticated RLS/RPC/concurrency/realtime runtime tests。
- Vercel project 尚未與本地專案 link，尚未設定 `VITE_SUPABASE_URL` 或 `VITE_SUPABASE_PUBLISHABLE_KEY`。
- 尚未建立 Web preview/production deployment。
- 尚未安裝 Capacitor、建立 iOS/Android project、簽名或送審。

## 外部操作規則

- migration、push、merge、Vercel deploy、production 操作與商店送審都要先回報操作目標與風險。
- 沒有 `service_role` key、真實密碼或兒童個資進入 source、bundle、GitHub 或公開環境。
- 若 runtime 測試失敗，停在 09，不進入 10。
