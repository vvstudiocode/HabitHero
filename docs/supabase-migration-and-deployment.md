# Supabase Migration 與部署規則

這份文件是 HabitHero 進行 Supabase 本地／遠端資料庫操作時的共用判斷規則。目標是讓後續 AI 或開發者先辨識 migration history 與實際 schema 的差異，再決定是否需要建立或部署 SQL。

## 核心原則

- `supabase/migrations/` 是 Git 中可重現、可部署的 schema 來源。
- 遠端 Dashboard 直接執行的 SQL 不會自動出現在本地；需要用 `supabase db pull` 保存成 migration，或手動把已驗證的變更整理成 migration。
- migration history 的筆數不同，不等於資料表或函式缺少。一定要分開檢查：
  1. migration 檔案與 `_supabase_migrations.schema_migrations` 的歷史。
  2. `public`／`private` schema 的實際 tables、functions、policies、indexes 與 grants。
- 未確認 history drift 前，不可使用 `db push --include-all`。重複套用舊 migration 可能造成 duplicate object、錯誤的資料清理或資料遺失。
- migration 與 schema 是資料庫結構；它們不會自動複製使用者資料、Auth 使用者、Storage 檔案或 Realtime 狀態。

## 2026-08-25 曾遇到的 history drift

這次比對得到：

- 遠端 migration history：174 筆
- 本地 migration 檔案：172 筆
- 完全相同的 version：132 筆
- 遠端才有的 version：42 筆
- 本地才有的 version：40 筆

因此「遠端多 2 筆」只是總筆數差，不代表只有兩個不同 SQL。主要原因是相同功能曾以不同 timestamp 重複建立，或本地與遠端使用了不同 timestamp 的同名 migration。

代表性的重複歷史：

- `add_arcadia_pet`：遠端 `20260816065247`、`20260816070159`
- `tune_arcadia_pet_visual_scale`：遠端有兩筆
- `lower_arcadia_to_grass`：遠端有兩筆
- `fix_following_pet_world_entities`：遠端有兩筆
- `preserve_roaming_pet_position`：遠端有兩筆

本地曾有遠端沒有同名 history row 的 migration：

- `replace_moko_with_five_actions`
- `replace_noah_with_five_actions`
- `shared_decoration_schema`
- `shared_decoration_rpcs`
- `shared_decoration_cleanup`
- `shared_decoration_own_world_projection`

但遠端實際 schema 已查到共享裝飾相關 tables，因此不能只因遠端 history 沒有同名 row，就判斷資料表遺失。它們可能由其他 migration 或先前直接執行的 SQL 建立；來源需要用實際 schema、migration statements 與資料庫物件定義交叉確認。

## 唯讀稽核流程

先檢查 CLI 版本與可用參數，不要憑記憶猜旗標：

```bash
npx supabase --version
npx supabase migration list --local
npx supabase migration list --linked
```

接著比較本地檔名、遠端 version/name，以及實際 schema。若遠端 history 與本地名稱大量錯位，先記錄 drift，不要直接 push。

本次檢查的結論是：實際 schema 基本一致，差異主要在 migration history；本次沒有修改遠端資料庫。

## 2026-09-09 唯讀稽核

- `npx supabase migration list --linked` 顯示本地 migration 檔案與遠端
  history 對齊。
- `npx supabase migration list --local` 顯示本機 Docker database 尚未套用
  `20260818051923_tune_arcadia_oum_nibus_walk_grounding.sql`；這是本機
  history drift，不是遠端缺 migration。
- `npx supabase db diff --local` 完成且 `dropStatements` 為空；輸出主要是
  本機角色權限與 default privileges 的 baseline 差異，沒有把它自動轉成
  migration。
- 本次沒有執行 `db reset`、history repair、`db push` 或
  `db push --include-all`。

## 正常的本地優先流程

### 1. 建立變更

必須用 Supabase CLI 建立 migration 檔案：

```bash
npx supabase migration new add_feature
```

不要自行編造 timestamp 檔名，也不要把一次性的 SQL 直接當成已可部署的 migration。

### 2. 套用與驗證本地資料庫

```bash
npx supabase migration up --local
npm test
npx supabase db diff --local
```

需要丟棄本地資料並從頭重建時，才使用專案既有的 reset 指令；reset 會清除本地資料，不能拿來當一般同步指令。

### 3. 部署前預覽

```bash
npx supabase db push --linked --dry-run
```

確認預覽只包含預期的新 migration，且沒有重跑舊 migration、刪除資料表或破壞性資料操作後，才可以部署：

```bash
npx supabase db push --linked
```

## 遠端先改過的情況

如果有人先在 Supabase Dashboard 執行 SQL：

1. 先唯讀查詢實際 schema 與遠端 migration history。
2. 用 `npx supabase db pull <descriptive-name> --local --yes` 把遠端 schema 保存成本地 migration，並審查產生的 SQL。
3. 在本地測試，再讓後續變更回到本地優先流程。

不要為了讓 history 筆數相等而偽造空 migration，也不要在沒有備份、dry-run 與明確回退方案時重寫遠端 migration history。History repair 是獨立的資料庫維運任務，不應和一般 UI 或功能 migration 混在同一個修改裡。

## 判斷與停止條件

遇到以下情況應停止自動部署並回報：

- 遠端與本地 version 大量錯位，且無法確認 SQL 是否等價。
- `db push --dry-run` 顯示重跑 Arcadia／寵物調整、drop table、drop function 或大量資料更新。
- 實際 schema 與 migration history 的來源無法對上。
- 需要修改遠端 history、刪除資料或執行破壞性 SQL。

官方參考：

- [Supabase Database Migrations](https://supabase.com/docs/guides/local-development/database-migrations)
- [Supabase CLI Getting Started](https://supabase.com/docs/guides/local-development/cli/getting-started)
