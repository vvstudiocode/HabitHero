# HabitHero AI 交接狀態

**更新日期：** 2026-07-21
**目前負責人：** 總指揮 agent
**下一個執行任務：** 10 Capacitor 原生專案（Web 已部署）

## 已完成登入與本機連結

| 系統 | 狀態 | 已確認內容 |
|---|---|---|
| GitHub | 已登入、已設定 remote | `vvstudiocode/HabitHero`；本地 branch `main`；尚未 commit/push |
| Supabase | 已登入、已 link | project `HabitHero`；ref `rqofqnoyxnmlsuejeyld`；三份 migration 已套用 |
| Vercel | 已登入、已部署 | project `vvstudiocodes-projects/habit-hero`；Preview/Production env 已設定；production `https://habit-hero-gilt.vercel.app` |

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

- authenticated RLS/RPC/concurrency/realtime runtime tests 尚未以真實測試帳號完整驗證。
- Supabase Auth redirect URLs 尚未由 CLI/MCP 設定與驗證。
- 尚未安裝 Capacitor、建立 iOS/Android project、簽名或送審。

## 外部操作規則

- migration、push、merge、Vercel deploy、production 操作與商店送審都要先回報操作目標與風險。
- 沒有 `service_role` key、真實密碼或兒童個資進入 source、bundle、GitHub 或公開環境。
- Web production 已部署；若 runtime 測試失敗，停在 09，不進入 10。

## 09 已完成項目

- Remote migration history：`20260720171257`、`20260720171304`、`20260720171307`。
- 所有核心表已建立並啟用 RLS；本機 security/lint/build 通過。
- Vercel production deployment：`dpl_7hq9cagcS2RtRg8xndrvAi1hVJDS`。
- Git commit：`a5217ad`，已 push 到 `origin/main`。
- Preview/production smoke test：首頁、家長註冊入口、孩子入口可回應；console errors 0。
