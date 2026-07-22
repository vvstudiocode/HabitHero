# HabitHero 商店與家庭安全交付規格

更新日期：2026-07-23

## 已實作

- 家長設定中提供隱私政策、支援中心、兒童/家長同意、帳號與資料刪除四個獨立入口。
- 每個入口以全螢幕右側滑入文件頁呈現，支援返回、Escape、safe-area、reduced motion、鍵盤 focus 與觸控最小尺寸。
- 家長同意使用 `parent_consents` 儲存版本與時間，由 `record_parent_consent` RPC 驗證家庭家長身份。
- App 內帳號刪除透過 JWT 驗證的 `manage-account` Edge Function，刪除家庭資料、孩子帳號與家長 Auth 帳號。
- 公開頁面：`/privacy-policy.html`、`/support.html`、`/delete-account.html`。
- Capacitor app ID/package ID：`com.habithero.app`。

## 上架前產品/法務必填

- 確認實際營運者名稱、公司所在地、支援 Email 與資料保護聯絡人。
- 確認 Supabase、AI 或其他第三方服務是否允許兒童導向產品，並補齊第三方隱私政策連結。
- 確認適用 COPPA、GDPR-K、當地兒少及個資法規的家長同意與資料保存期限。
- 在 App Store Connect 填寫 App Privacy，並在 Google Play 填寫 Target Audience、Data Safety、IARC 與 Data deletion。
- 以真機完成 TestFlight/Play internal testing、登入/登出、帳號刪除、窄螢幕、離線與 Realtime 驗收。

## 不可宣稱的項目

本文件不等於法律意見，也不代表已取得 Apple 或 Google 審核通過。正式送審前必須使用實際營運者資料替換示例聯絡方式，並由產品/法務核准政策內容。
