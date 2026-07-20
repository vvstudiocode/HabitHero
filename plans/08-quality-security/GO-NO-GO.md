# HabitHero 前 7 點總驗收

日期：2026-07-20

## 結論

**NO-GO FOR DEPLOYMENT**

本工作區沒有 Supabase project credentials、local Postgres/Supabase runtime 或可用的 authenticated test sessions，因此不能宣稱 runtime RLS、RPC transaction、Realtime、session refresh/logout 與跨家庭隔離已驗證。依交付門檻，未進入 09/10。

## 已通過

- `npm run lint`：通過。
- `npm run build`：通過；只有既有的 chunk 大小 advisory。
- `npm run security:check`：通過，掃描 source、migration、設定與契約。
- source 未發現 service-role key、production credential 或以 `user_metadata` 作授權的程式碼；invite token 僅在 redeem 流程記憶體中使用。
- client 只讀取 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_PUBLISHABLE_KEY`。
- child direct reads 的 follow-up migration 已收窄至本人 child profile；parent 保留家庭範圍讀取。
- child invite RPC 使用固定 `search_path`；raw token 只回傳一次，table 無 authenticated table privileges，RPC 只授權 authenticated。
- child redeem 以 `FOR UPDATE` 並在同一 RPC 內建立 membership、child profile、標記 redeemed。
- task approval 與 reward redemption 使用 transaction-safe RPC/row locks；wishlist approval 已改為 atomic `approve_wishlist_item` RPC。
- 登出先清空 provider 的 protected domain state，再呼叫 Supabase sign-out。

## Runtime 阻擋清單

以下需要 Supabase runtime、測試帳號與至少兩個家庭才能關閉：

- anonymous、跨家庭 parent、child 讀取/寫入所有 exposed tables 的實際 RLS allow/deny matrix。
- child 只能看到本人 tasks、rewards、wishlist、redemptions、ledger，不能列舉同家庭其他孩子。
- invite create/redeem：過期、撤銷、重複 redeem、錯誤 user、並發 redeem 與跨家庭 token。
- parent approve、child redeem、wishlist approval 的並發與 rollback 行為。
- 兩個 authenticated sessions 的 Realtime 收訊、斷線恢復、訂閱 cleanup 與 session switch。
- Auth refresh、session expiry、sign-out failure 與 browser reload 後的 protected state 清理。
- 窄手機 viewport、鍵盤操作與 production-like error message redaction。

## 可重複檢查

`npm run security:check` 不依賴 production credentials，會檢查禁止的 secret/metadata 授權、RLS ownership predicate、invite function hardening、child query ownership、logout state clearing 與 atomic wishlist RPC。
