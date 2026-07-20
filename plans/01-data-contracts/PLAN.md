# 01 共用資料契約與遷移邊界

## 目標

將現有 `src/types.ts` 的 localStorage domain model 整理成前端與 Supabase 共用的明確契約，讓後續任務不各自發明欄位。

## 允許修改

- `src/types.ts`
- `src/lib/` 下新增的純型別/映射檔
- `plans/01-data-contracts/`

## 不可修改

UI 元件、Auth、Supabase migration、Vercel/Capacitor 設定。

## 工作內容

- 定義 profile、family、member、child、task、reward、wishlist、redemption、point ledger 的前端型別。
- 明確區分資料庫 row、UI view model、mutation input，避免把 DB 欄位直接散落在元件。
- 保留既有 `todo/pending/completed` 狀態語意與每日任務規則。
- 定義 ID、時間、點數、排序與 nullable 欄位約束。
- 記錄 localStorage 舊 schema 僅供參考，不在本任務執行資料刪除或自動遷移。

## Acceptance Criteria

- AC-01：所有後續資料表都有唯一前端型別與 mutation input。
- AC-02：型別能表達孩子只能屬於一個家庭、任務屬於一個孩子與一個家庭。
- AC-03：`npm run lint` 通過，且不引入任何 runtime Supabase 依賴。

## 交付

型別檔、映射說明與一份變更摘要；不得修改 UI 行為。
