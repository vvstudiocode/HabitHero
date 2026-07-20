# HabitHero 多裝置改造總規格

**狀態：** Draft，等待總指揮逐任務派工與審核
**範圍：** 前 8 點；第 9、10 點刻意延後
**現況：** Vite + React + TypeScript；主要狀態在 `src/store.tsx`，使用 localStorage；尚無雲端身份、資料庫、測試與原生殼層。

## 目標

家長與孩子可以在各自手機或 Web 登入同一個家庭，資料由 Supabase Auth、Postgres 與 RLS 管理；既有任務、獎勵、點數與審核行為維持一致。

## 角色與安全模型

- `parent`：建立家庭、管理孩子、任務、獎勵、審核與兌換。
- `child`：只能看自己的任務、點數、願望清單與已核准紀錄。
- 家庭成員關係以資料庫表與 RLS 判斷，不以 `user_metadata` 作授權依據。
- 前端只使用 Supabase publishable/anon key；service-role key 僅能留在受控後端環境，前 8 點不需要放入瀏覽器或 App。

## 目標資料模型

`profiles`、`families`、`family_members`、`child_profiles`、`task_templates`、`tasks`、`rewards`、`wishlist_items`、`reward_redemptions`、`point_ledger`。

點數不得由前端直接寫入任意餘額；完成任務、家長核准、兌換獎勵必須透過交易安全的資料庫函式或受控 mutation。

## 暫定流程

家長註冊/登入 → 建立家庭 → 建立孩子邀請資料 → 孩子用自己的 Auth 帳號加入家庭 → 孩子完成任務進入 pending → 家長核准 → point ledger 入帳 → 孩子兌換獎勵。

## 未決產品問題

- 孩子登入採 email/password、magic link，或由家長建立的受控帳號？本計劃先以 email/password 可測試流程描述，實作前由總指揮確認兒童帳號政策。
- 兒童資料保存期限、刪除方式、家長同意與隱私政策需在上架前由產品/法務確認；這些不從程式碼推定。
- localStorage 舊資料是否需要一次性匯入？本階段預設提供明確的「開始雲端家庭」流程，不自動覆蓋雲端資料。

## 驗收總門檻

- 任務完成狀態不能因重新整理、換裝置或重新登入而遺失。
- 不同家庭無法讀取或修改彼此資料；孩子無法執行家長動作。
- 網路錯誤有可理解的 UI 狀態，不會假裝寫入成功。
- `npm run lint` 與 `npm run build` 通過；第 08 任務另行定義安全與整合驗收。
