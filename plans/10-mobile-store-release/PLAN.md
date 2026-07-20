# 10 Capacitor iOS/Android 建置與雙平台上架

**狀態：** 暫緩，必須先完成 09 且 Web/Backend runtime gate 通過。

## 交給其他 AI 的起點

從 `plans/10-mobile-store-release/PLAN.md` 開始，先讀 `plans/09-vercel-supabase-deployment/PLAN.md`、`plans/08-quality-security/GO-NO-GO.md` 與 [ACCESS-SETUP.md](../ACCESS-SETUP.md)。

## 依賴

- 09 Vercel preview/production 與 Supabase Auth redirect 已驗證。
- Apple Developer、App Store Connect、Google Play Console 帳號已登入。
- App name、bundle ID/package name、icon、privacy policy、support URL、資料刪除流程已由產品確認。
- 兒童/家庭資料的家長同意、年齡與隱私規範已由產品/法務確認。

## 執行順序

1. 安裝並鎖定 Capacitor 版本，確認 `npm run build`。
2. 建立 iOS/Android platforms，設定 bundle ID、package name、display name、icons、splash 與 URL scheme。
3. `npx cap sync` 後檢查 native diff；不要把 Supabase secret 寫入 native project。
4. 在真機驗證 Auth session、deep link/redirect、孩子 invite、push/通知需求、鍵盤與窄螢幕。
5. 建立 TestFlight 與 Play internal testing build；檢查 crash、logout、資料權限與離線狀態。
6. 產出 privacy policy、data safety、兒童/家長同意、帳號刪除與 support metadata。
7. 先上架 internal/beta，完成審核前的功能與隱私檢查後才送 production review。

## Required Acceptance Criteria

- AC-10-01：iOS 與 Android 可安裝、啟動、登入、刷新、登出並完成核心任務流程。
- AC-10-02：兩平台不含 service-role/secret key，Auth redirect 與 production domain 正確。
- AC-10-03：孩子只能存取自己的資料，家長核准與點數交易維持 DB atomic 行為。
- AC-10-04：商店 metadata、隱私政策、資料刪除與家長同意流程完成並可被驗證。
- AC-10-05：TestFlight/Play internal test 通過後，才可取得使用者對 production submit 的明確授權。

## 停止條件

- 09 未通過：停止，不建立 release build。
- 沒有 Apple/Google 開發者權限或產品/法務資料：停止，不送審。
- 任何兒童資料授權、刪除或隱私要求不明：停止，回報產品決策，不自行猜測。
