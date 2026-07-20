# 04 Supabase 資料存取層與 App Provider

## 目標

把 UI 從 localStorage store 解耦，建立可測試的 query/mutation service 與 session-aware provider。

## 依賴

02 Auth、03 DB/RLS、01 型別。

## 允許修改

- `src/store.tsx` 或替代 provider
- `src/lib/` 的 Supabase repository/query/mutation 檔案
- `src/App.tsx`、`src/main.tsx` 的 provider wiring
- 對應測試檔

## 工作內容

- 將現有讀寫操作轉成明確 async API，不讓元件直接呼叫任意 Supabase table。
- 統一 loading、error、empty、stale data 與 retry 狀態。
- session、active family、active child 的狀態來源集中管理。
- 保留目前 UI 可用的 action 介面，降低 05/06 的元件改動。
- localStorage 僅可作非敏感 UI 偏好或暫存草稿，不作權威資料來源。

## Acceptance Criteria

- AC-01：重新整理後 provider 能恢復 session、家庭與孩子資料。
- AC-02：任何 mutation 失敗時 state 不會先被永久假設為成功。
- AC-03：repository 可用 mock client 測試，不需在單元測試連 production Supabase。
- AC-04：元件不再直接依賴 `localStorage` 取得權威任務、點數或獎勵資料。
