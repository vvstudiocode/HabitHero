# Unity / Supabase / Vercel 外部設定清單

這份清單定義 Unity 重構完成後，仍必須在外部平台補上的設定。設定值
不要貼到對話、不要 commit，也不要放進公開的 `VITE_` 以外環境變數。

## 目前程式已可驗證的部分

- GitHub monorepo、Unity 專案、Supabase client 邊界與 Vercel Web build 已
  在本機完成驗證。
- Unity Android 端沒有 Firebase 憑證時仍可建置；只有 FCM token 註冊與
  實際推播會回報未設定。
- iOS / Android 原生輸出、Auth callback scheme、Supabase REST / Realtime
  contract 與 Edge Function payload 均有自動化測試。

## 必須由外部平台完成的設定

### 1. Vercel Web

在 `habit-hero` 的 Preview / Production 環境設定：

- `VITE_SUPABASE_URL`：`https://rqofqnoyxnmlsuejeyld.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY`：目前 Supabase project 的 publishable key

這兩個值會進入瀏覽器 bundle，只能使用 publishable key；不可使用
`service_role`、secret key 或其他伺服器憑證。

### 2. Unity 本機或 CI

Unity 需要與 Web 相同的公開 Supabase 設定：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- 可選：`HABITHERO_GAME_ASSET_BASE_URL`，若要載入 Vercel 上的公開 GLB / 音效

Unity Android 若要啟用 FCM，另外以本機檔案或 CI secret file 注入：

- `unity/HabitHero/Assets/Plugins/Android/google-services.json`
- Firebase Android package 必須是 `com.vvstudiocode.habithero`

`google-services.json` 已被 Git ignore，不能放進 GitHub、Vercel public env、
Unity WebGL 或 iOS bundle。

### 3. Supabase Edge Function secrets

在 Supabase project `rqofqnoyxnmlsuejeyld` 的 Edge Function secrets 設定：

#### FCM HTTP v1

- `FCM_PROJECT_ID`
- `FCM_CLIENT_EMAIL`
- `FCM_PRIVATE_KEY`：service-account PKCS#8 PEM，或以 `\\n` 表示換行

另外要在 Firebase Console 啟用 Firebase Cloud Messaging API，並授予該
service account 發送 FCM HTTP v1 的權限。

#### APNs

- `APNS_KEY_ID`
- `APNS_PRIVATE_KEY`：App Store Connect / Apple Developer `.p8` 內容的 base64
- `APNS_BUNDLE_ID=com.vvstudiocode.habithero`
- `APNS_SANDBOX_TEAM_ID`
- `APNS_PRODUCTION_TEAM_ID`
- `APNS_ENVIRONMENT`：Debug 用 `sandbox`，TestFlight / Production 用 `production`

Edge Function 平台本身提供的 `SUPABASE_URL`、
`SUPABASE_SERVICE_ROLE_KEY` 也必須只存在 Supabase secret environment，不能
進入 Unity、Web bundle、Vercel public env、GitHub 或任何 app binary。

### 4. Firebase / Android

- Firebase project 與 HabitHero 使用同一個 Android package：
  `com.vvstudiocode.habithero`
- 下載對應 Android app 的 `google-services.json`
- 啟用 FCM API
- Android 13+ 實機允許通知權限
- 實機或 emulator 必須有 Google Play services

### 5. Apple / Google 發佈

- Apple Developer：既有 Bundle ID `com.vvstudiocode.habithero`、Push
  Notifications capability、signing certificate、provisioning profile
- App Store Connect：TestFlight 權限與既有 app 的更新發佈權限
- Google Play Console：既有 package `com.vvstudiocode.habithero`、upload
  keystore / Play App Signing、closed testing 權限
- 兩邊都要保留既有 app identity，不能另建新 package / Bundle ID，否則無法
  以更新方式送審與保留使用者資料。

## 最後驗收需要的外部條件

- 一台可安裝 iOS build 的實機與一台有 Google Play services 的 Android 實機
- 一組 parent 測試帳號與至少一個 child 測試帳號
- 兩個可同時登入的測試裝置，用來驗證 Realtime、friend world、co-op 與
  reconnect
- 已設定的 Firebase / APNs secrets，用來驗證 token 註冊、通知送達與通知點擊
- TestFlight 與 Google Play closed testing 的測試軌道

在上述外部條件完成前，CI/build/contract 通過只能代表「可部署邊界完整」；
不能宣稱已完成真機推播、商店更新或所有 Unity 視覺與多人流程驗收。
