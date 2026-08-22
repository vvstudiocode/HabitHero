# 中央氣象署天氣 API 設定

## 已完成的串接

- 前端只呼叫 Supabase Edge Function `get-weather`。
- Edge Function 使用中央氣象署 `F-C0032-001` 臺北市預報資料。
- Supabase 共用快取 15 分鐘，避免每位玩家各自呼叫中央氣象署。
- CWA 授權碼不進前端、不進 Vercel `VITE_` 變數、不進 Git。
- CWA 尚未設定時，遊戲會暫時使用 Open-Meteo fallback，不會讓世界場景失效。

## 第一次設定：貼上 CWA 授權碼

1. 到 [中央氣象署開放資料平台](https://opendata.cwa.gov.tw/) 註冊／登入。
2. 在會員資訊中取得 API 授權碼。
3. 到 Supabase Dashboard，選擇 HabitHero 專案。
4. 開啟 Edge Functions 的 Secrets 管理頁。
5. 新增：

   - Name：`CWA_API_KEY`
   - Value：貼上中央氣象署授權碼

6. 儲存即可，不需要重新部署 Edge Function。

也可以在本機用 Supabase CLI 設定遠端 Secret；請在自己的終端機貼值，不要把授權碼寫入檔案或提交 Git：

```bash
supabase secrets set CWA_API_KEY='你的中央氣象署授權碼' --project-ref rqofqnoyxnmlsuejeyld
```

## Vercel 要不要設定？

不需要新增 CWA 變數。Vercel 只保留前端既有的：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

位置是：Vercel Dashboard → HabitHero 專案 → Settings → Environment Variables。

不要在 Vercel 建立 `VITE_CWA_API_KEY`，也不要放 `SUPABASE_SERVICE_ROLE_KEY`；任何 `VITE_` 變數都會進瀏覽器 bundle。

## Supabase 要不要設定其他值？

只需要新增 `CWA_API_KEY`。`SUPABASE_URL` 與 Supabase 的伺服器金鑰由 Edge Functions 執行環境提供，不需要複製到 Vercel 或前端。

相關官方資料：[中央氣象署開發指南](https://opendata.cwa.gov.tw/devManual/insrtuction)、[F-C0032-001 資料集](https://opendata.cwa.gov.tw/dataset/all/F-C0032-001)、[Supabase Edge Function Secrets](https://supabase.com/docs/guides/functions/secrets)。
