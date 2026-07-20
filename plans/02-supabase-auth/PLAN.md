# 02 Supabase Auth 與身份流程

## 目標

讓家長與孩子能在自己的手機或 Web 使用 Supabase Auth 登入，且 session 可在重新整理與跨平台啟動後恢復。

## 依賴

01 完成的資料契約。

## 允許修改

- `package.json`、lockfile
- `src/lib/supabase.ts`
- `src/components/ParentLogin.tsx`
- `src/components/ChildLogin.tsx`
- `src/components/ParentSetup.tsx`
- 新增 `src/auth/` 或等價 auth provider 檔案

## 工作內容

- 安裝並單例建立 `@supabase/supabase-js` client。
- 使用 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_PUBLISHABLE_KEY`；缺少 env 時顯示可理解錯誤。
- 建立 session bootstrap、`getSession` 與 `onAuthStateChange` 訂閱及清理。
- 家長註冊/登入/登出；孩子登入與加入家庭的介面契約交給 03/04 實作。
- 不把角色或家庭授權放在 `user_metadata`；角色以 DB membership 查詢為準。

## Acceptance Criteria

- AC-01：有效帳號登入後重新整理仍保留 session。
- AC-02：登出後受保護畫面不可再讀取家庭資料。
- AC-03：錯誤密碼、未設定 env、網路錯誤都顯示可恢復錯誤。
- AC-04：瀏覽器 bundle 與原生 App 不含 service-role key。

## 驗證

單元測試 auth adapter；使用 Supabase 非生產測試專案手動驗證註冊、登入、刷新、登出。
