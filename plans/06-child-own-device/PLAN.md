# 06 孩子端個人手機流程

## 目標

孩子使用自己的手機登入自己的帳號，只能操作自己的任務與願望清單，並能看到家長核准後的點數與歷史。

## 依賴

04 資料存取層；03 的 child RLS/RPC；02 Auth。

## 允許修改

- `src/components/ChildDashboard.tsx`
- `src/components/ChildLogin.tsx`
- 孩子流程專用 hooks 與測試

## 工作內容

- 登入後由 DB membership/child profile 決定 active child，不信任 URL 或前端傳入的 child id。
- 孩子完成任務時只提交 pending；不能自行入帳點數、核准任務或改 reward。
- 顯示同步中的 loading、離線/失敗提示與重試操作。
- 保留倒數計時、任務完成、wishlist 與兌換體驗，但將權威狀態改由 Supabase 回傳。
- 避免在裝置上保存孩子密碼、session 以外的敏感資料。

## Acceptance Criteria

- AC-01：孩子登入後只能查到自己的資料；嘗試換 child id 仍被 RLS 擋下。
- AC-02：完成任務後狀態為 pending，家長核准前點數不增加。
- AC-03：點數不足兌換時不產生部分成功狀態。
- AC-04：孩子登出後 back navigation 或重新整理不會重新顯示受保護資料。
