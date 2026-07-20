# 03 Supabase DB、Migration、RLS 與 RPC

## 目標

建立可部署、可重複執行、預設拒絕的 Postgres schema，確保家庭隔離、角色授權與點數交易在資料庫層成立。

## 依賴

01 的資料契約。

## 允許修改

- `supabase/migrations/`
- `supabase/seed.sql`（只放合成測試資料）
- `plans/03-supabase-db-rls/`

## 工作內容

- 建立總規格列出的 tables、PK/FK、check constraint、unique constraint、created/updated timestamps。
- 所有 exposed public tables 啟用 RLS。
- policy 必須包含 authenticated role 與 family/member/child ownership predicate；不可只寫 `TO authenticated`。
- INSERT/UPDATE/DELETE 驗證新值與舊值的家庭及角色邊界。
- 以 transaction-safe RPC 處理 `approve_task_completion`、`redeem_reward` 等點數 mutation，避免前端直接改 balance。
- 加入必要 index 與 migration rollback/重新套用說明。

## Acceptance Criteria

- AC-01：未登入、跨家庭 parent、非本人 child 的 select/insert/update/delete 都被拒絕。
- AC-02：孩子只能提交自己的 task completion，不能核准任務或建立 reward。
- AC-03：同一任務核准兩次不會重複入帳；點數不足兌換不會產生 redemption 或扣款。
- AC-04：migration 可在乾淨測試專案套用，seed 不包含真實個資或秘密。

## 驗證

Supabase local database migration、SQL policy test、RPC transaction test；禁止直接對 production 做破壞性測試。

## 子 agent 交付紀錄

- Migration：`supabase/migrations/20260720120000_habithero_schema_rls_rpc.sql`
- Seed：`supabase/seed.sql` 保持空白，避免未建立 Auth identity 時插入無效或真實資料。
- Rollback（僅限隔離的本地/測試專案）：先撤銷 `authenticated` 對 public tables/functions 的 grants，再依外鍵反向刪除 `point_ledger`、`reward_redemptions`、`wishlist_items`、`rewards`、`tasks`、`task_templates`、`child_profiles`、`family_members`、`families`、`profiles`，最後刪除 private functions/schema。不要對 production 執行 destructive rollback。
- 本環境沒有 `supabase` CLI、Postgres client、local database 或 project credentials；已完成 SQL 靜態檢查與 diff 審核，尚未完成實際 migration、RLS policy、RPC transaction 測試。

### AC 結果

- AC-01：SQL 靜態檢查通過。10 張 public table 全部啟用 RLS；anon/PUBLIC table 權限撤銷；authenticated policy 均含家庭、member、parent 或 child ownership predicate。未能執行雙家庭資料庫實測。
- AC-02：SQL 靜態檢查通過。child task policy 僅允許本人 `todo -> pending`，trigger 鎖定其他欄位；reward 建立與 approve RPC 均要求 parent predicate。未能執行 authenticated impersonation 實測。
- AC-03：SQL 靜態檢查通過。approve 以 task/child row lock、task ledger unique constraint 與狀態檢查避免重複入帳；redeem 以 child row lock、餘額檢查與同一 transaction 建立 redemption/ledger。未能執行並發與 rollback 實測。
- AC-04：migration 為自包含 schema，`seed.sql` 無 insert、個資或秘密；靜態檢查通過。未能在乾淨 Supabase 專案套用。
