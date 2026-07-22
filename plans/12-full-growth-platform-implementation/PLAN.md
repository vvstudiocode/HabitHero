# HabitHero 完整自主成長平台實作計劃

**狀態：** Approved implementation plan  
**日期：** 2026-07-22  
**總指揮：** Codex  
**目標：** 直接完整改造現有 HabitHero，從家長派任務型產品升級為「孩子主動目標 + 家長確認 + 完成心得 + 家長批改鼓勵 + 成長統計」平台。  

## 1. 已確認產品決策

本輪直接做完整版本，不以小幅 MVP 為限制。

已同意暫不做：

- 語音附件。
- 照片附件。
- AI 自動批改。
- 複雜月報 PDF。
- 社群、排行榜。
- 多家庭公開模板市場。

仍要完整做：

- 孩子自主新增今日目標。
- 固定主類別，支援後續統計。
- 家長確認/退回/調整點數。
- 孩子完成後提交心得與自評。
- 家長審核、批改、鼓勵留言、調整實際給點。
- 成長紀錄與統計。
- 任務模板與固定分類整合。
- RLS/RPC 權限完整限制。
- Web 先部署，但資料與 UI 設計需保留未來 App 化彈性。

## 2. 核心產品模型

新的任務流程是：

```text
child creates goal
  -> proposed
parent confirms / returns
  -> todo
child submits completion reflection
  -> pending
parent reviews / requests revision / approves
  -> completed
```

狀態定義：

| 狀態 | 中文 | 說明 |
|---|---|---|
| `proposed` | 等待確認 | 孩子主動提出，家長尚未確認 |
| `todo` | 今日目標 | 家長已確認，孩子可以開始 |
| `pending` | 等待審核 | 孩子完成並提交心得 |
| `revision_requested` | 需要補充 | 家長要求孩子補充或重做 |
| `completed` | 已完成 | 家長通過並發點 |

任務來源：

| 來源 | 說明 |
|---|---|
| `child_proposed` | 孩子主動建立 |
| `parent_suggested` | 家長建議孩子接受 |
| `parent_assigned` | 家長直接建立 |
| `system_template` | 系統/模板建立 |

固定主類別：

| 類別 | 中文 |
|---|---|
| `life_habit` | 生活自理 |
| `learning` | 學習成長 |
| `health` | 健康體能 |
| `relationship` | 人際情緒 |
| `family_contribution` | 家庭貢獻 |
| `creativity` | 創造探索 |

## 3. 專案目錄與檔案拆分

避免把所有功能繼續堆在 `ParentDashboard.tsx` / `ChildDashboard.tsx`。本輪應新增以下資料夾：

```text
src/features/growth/
  constants.ts
  goal-copy.ts
  growth-stats.ts
  growth-stats.test.ts
  components/
    CategoryBadge.tsx
    GrowthSummaryPanel.tsx
    GoalCard.tsx
    GoalProposalForm.tsx
    GoalReviewPanel.tsx
    GoalSubmissionForm.tsx
    ParentFeedbackForm.tsx
```

資料與存取層維持原邊界：

```text
src/types.ts
src/lib/data-contracts.ts
src/lib/data-access.ts
src/store.tsx
supabase/migrations/
tests/
```

既有 dashboard 應轉為組合功能：

- `ChildDashboard` 負責頁面殼、tabs、資料串接。
- `ParentDashboard` 負責頁面殼、tabs、資料串接。
- 成長任務卡片、表單、統計面板放進 `src/features/growth/components`。

## 4. 資料庫變更

新增 migration，禁止直接修改已存在 migration。

建議 migration 名稱：

```text
supabase/migrations/<timestamp>_child_led_growth_feedback.sql
```

### 4.1 `task_templates` 欄位

新增：

```sql
category text not null default 'life_habit'
suggested_evidence text not null default 'reflection'
```

`category` 加 check constraint，值限固定 6 類。

### 4.2 `tasks` 欄位

新增：

```sql
category text not null default 'life_habit'
origin text not null default 'parent_assigned'
original_name text
original_points integer
confirmed_at timestamptz
confirmed_by uuid references public.profiles(id)
submitted_at timestamptz
reviewed_at timestamptz
reviewed_by uuid references public.profiles(id)
approved_points integer
child_reflection_text text
child_mood text
child_difficulty smallint
parent_feedback_text text
parent_correction_text text
feedback_tone text
revision_note text
```

約束：

- `category` 必須是固定 6 類。
- `origin` 必須是固定 4 類。
- `child_difficulty` 為 1 到 5。
- `approved_points` 若存在，需大於等於 0。
- `completed` 需要 `reviewed_at`。
- `pending` 需要 `submitted_at`。

### 4.3 RLS 與 RPC

新增/調整能力：

- 孩子可以 insert 自己的 `child_proposed` task，初始 `status = proposed`。
- 孩子不能直接建立 `todo/completed`。
- 孩子不能改點數、類別以外的家長審核欄位。
- 家長可以確認 proposed task，調整名稱/點數/類別。
- 家長可以退回 proposed task。
- 孩子可以提交 `todo` 或 `revision_requested` 任務為 `pending`。
- 家長可以審核 `pending` 任務：
  - approve -> 發點並寫 `point_ledger`
  - request revision -> 回到 `revision_requested`

建議新增 RPC：

```sql
public.confirm_child_goal(target_task_id uuid, confirmed_name text, confirmed_points integer, confirmed_category text)
public.return_child_goal(target_task_id uuid, target_revision_note text)
public.submit_task_reflection(target_task_id uuid, reflection text, mood text, difficulty smallint)
public.review_task_completion(target_task_id uuid, approved boolean, approved_points integer, feedback text, correction text, tone text, revision_note text)
```

既有 `approve_task_completion` 可保留相容，但新前端應改用 `review_task_completion`。

## 5. TypeScript 合約

更新 `src/types.ts`：

- `TaskStatus` 擴充到 5 種。
- 新增 `TaskCategory`。
- 新增 `TaskOrigin`。
- 新增 `FeedbackTone`。
- `TaskRow` / `TaskViewModel` / legacy `Task` 增加新欄位。
- `TaskTemplateRow` / `TaskTemplateViewModel` 增加 `category` 與 `suggestedEvidence`。

新增 `src/features/growth/constants.ts`：

- 固定分類清單。
- 分類中文名。
- 分類 icon 名稱。
- mood choices。
- feedback tone choices。
- helper：`getTaskCategoryMeta`、`getTaskStatusLabel`。

新增 `src/features/growth/growth-stats.ts`：

- `buildGrowthStats(children, ledger)`
- `getChildGrowthSummary(child)`
- `getCategoryDistribution(tasks)`
- `getChildInitiativeMetrics(tasks)`
- `getFeedbackMetrics(tasks)`

測試放：

```text
src/features/growth/growth-stats.test.ts
tests/data-contracts-growth.test.ts
```

注意目前 `npm test` 只跑 `tests/*.test.ts`，因此需要：

- either 將 feature 測試放 `tests/`
- or 修改 test script 支援 `src/**/*.test.ts`

本輪建議修改 script：

```json
"test": "tsx --test tests/*.test.ts src/**/*.test.ts"
```

## 6. 前端功能

### 6.1 孩子端

`ChildDashboard` 新 tabs：

- `goals`：今日目標。
- `growth`：成長紀錄。
- `wishlist`：許願與獎勵。
- `history`：兌換紀錄。

孩子端新增功能：

- 新增今日目標。
- 選擇固定主類別。
- 可從模板快速建立，但任務來源仍要清楚。
- 查看等待家長確認的目標。
- 查看退回補充的目標。
- 完成任務時填寫：
  - 心得文字。
  - 心情。
  - 難度 1-5。
- 查看家長鼓勵與批改。
- 查看簡單成長統計。

### 6.2 家長端

`ParentDashboard` 新 tabs：

- `review`：審核中心。
- `tasks`：今日目標管理。
- `templates`：模板庫。
- `growth`：成長紀錄。
- `rewards`：獎勵。
- `wishlist`：許願。

家長端新增功能：

- 待確認目標：
  - 確認。
  - 調整名稱。
  - 調整點數。
  - 調整類別。
  - 退回並留言。
- 待審核完成：
  - 看孩子心得/心情/難度。
  - 通過並給點。
  - 實際發放點數可與預設不同。
  - 留鼓勵留言。
  - 留批改/補充建議。
  - 要求補充。
- 成長統計：
  - 每個孩子主動目標數。
  - 完成率。
  - 類別分布。
  - 家長回饋數。
  - 連續完成天數。

## 7. App 化注意事項

雖然目前是 Web/Vite，設計時要避免綁死瀏覽器細節：

- 成長流程邏輯放 `src/features/growth` 純函式與元件，降低未來移植成本。
- 資料合約不依賴 DOM。
- 不做 Web-only file APIs，因照片/語音已排除本輪。
- UI 控制使用可觸控大小，至少 44px。
- 表單流程保留單手操作與窄螢幕 layout。
- 不把通知邏輯硬寫為 browser push；先做狀態與紅點，未來 App 可接 native push。
- 日期統計以 ISO date / timezone-aware helper 處理，避免 App 與 Web 時區不一致。

## 8. 測試與驗收

必跑：

```bash
npm test
npm run lint
npm run build
npm run security:check
```

測試重點：

- 任務分類統計正確。
- `child_proposed` 與 `parent_assigned` 分開統計。
- 家長回饋數、批改數、退回數正確。
- `TaskRow -> TaskViewModel` 轉換保留新欄位。
- 孩子端只能提出/提交自己的任務。
- 家長審核通過才發點。
- 退回補充不發點。
- 重複 approve 不重複入帳。

若無本地 Supabase DB 可跑，至少要：

- 靜態檢查 migration SQL。
- TypeScript 編譯通過。
- repository 呼叫參數測試通過。

## 9. 多代理分工

總指揮本地負責：

- 最終整合。
- 衝突解決。
- 跑測試與修正。
- 安全與產品一致性確認。

Agent A：資料庫/RLS/RPC

- 負責 `supabase/migrations/`。
- 新增 child-led growth migration。
- 更新任務狀態、分類、來源、回饋欄位。
- 新增 confirm/return/submit/review RPC。
- 檢查 RLS 不允許孩子越權。

Agent B：資料合約/資料存取/測試

- 負責 `src/types.ts`、`src/lib/data-contracts.ts`、`src/lib/data-access.ts`、`src/store.tsx`、`tests/`。
- 更新 TypeScript 型別。
- 新增 repository 方法。
- 新增 growth data-contract 測試。

Agent C：前端功能元件

- 負責 `src/features/growth/` 與 dashboard 整合。
- 建立分類 badge、目標卡片、孩子提案表單、提交心得表單、家長審核表單、成長統計面板。
- 修改 `ChildDashboard` / `ParentDashboard` 使用新元件。

Agent D：驗收審查

- 等主要實作合併後進行 review。
- 檢查安全、權限、測試缺口、App 化風險與 UI/UX 風險。

## 10. 完成標準

本輪完成後應滿足：

- 孩子可以主動建立今日目標。
- 家長可以確認/退回目標。
- 孩子可以提交完成心得、自評心情與難度。
- 家長可以審核、批改、鼓勵、調整實發點數。
- 成長紀錄能按固定分類和任務來源統計。
- 點數仍只透過可信 RPC 入帳。
- 現有獎勵、許願、兌換流程可繼續使用。
- 測試、lint、build、安全檢查通過，或明確列出無法驗證原因。
