# 01 資料契約變更摘要

## 契約分層

- `src/types.ts` 的 `*Row` 型別代表資料庫欄位（snake_case、ISO timestamp、nullable 欄位明確標示）。
- `*ViewModel` 型別代表 UI 可讀資料（camelCase）；localStorage 舊模型的 `Task`、`Reward`、`Child` 等名稱暫時保留以維持既有編譯相容性。
- `*CreateInput` 與 `*UpdateInput` 型別代表 mutation 邊界。`PointLedgerCreateInput` 只描述受控 mutation 的輸入，不代表前端可任意改寫點數餘額。

## 關聯與約束

- `ChildProfileRow.family_id` 表達每個孩子只有一個家庭歸屬；資料庫應以 child profile 的唯一性約束及外鍵落實此契約。
- `TaskRow` 同時帶有 `family_id` 與 `child_profile_id`，表達任務必須屬於一個家庭內的一個孩子；後續 migration 應以複合關聯或受控函式驗證兩者一致。
- 同理， reward、wishlist、redemption、point ledger 都保留家庭與孩子關聯，避免只靠 UI 推導授權範圍。

## 舊 localStorage schema

目前 `family_habit_app_state_v2` 的 `AppState`、`Child`、`Task`、`Reward`、`WishlistItem`、`Ticket` 與 `TaskTemplate` 僅作參考。此任務不刪除資料、不執行自動遷移，也不改變現有每日任務 reset 行為；正式 adapter 與遷移由後續任務處理。

## 映射

`src/lib/data-contracts.ts` 提供純函式，將 profile、family、member、child profile、task、redemption row 映射為 view model；不匯入 Supabase SDK，也不執行 I/O。
