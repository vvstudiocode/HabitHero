# 05 家長端雲端流程

## 目標

將家長建立家庭、管理孩子、建立任務與獎勵、審核完成、處理兌換的完整流程接到雲端資料。

## 依賴

04 資料存取層；03 的 role/RLS/RPC 已可用。

## 允許修改

- `src/components/ParentDashboard.tsx`
- `src/components/ParentSetup.tsx`
- `src/components/ParentLogin.tsx` 的 UI wiring
- 家長流程專用 hooks
- 對應測試

## 工作內容

- 建立家庭與第一位孩子的初始化流程。
- 邀請碼/加入碼不得使用可猜測且永久有效的授權；保存 hashed/受控狀態與過期策略交由 03 落地。
- 家長可建立、編輯、封存 task template、task、reward、wishlist review。
- 審核任務與核准兌換使用受控 mutation，成功後重新驗證 server state。
- 所有 mutation 提供成功、失敗、重試與 disabled 狀態。

## Acceptance Criteria

- AC-01：家長只能看到自己家庭的孩子、任務、獎勵與兌換。
- AC-02：家長核准一次任務只增加一次點數。
- AC-03：建立/編輯失敗時表單保留輸入且不顯示虛假的成功資料。
- AC-04：家長端無法透過 UI 或直接 client request 執行另一家庭的 mutation。
