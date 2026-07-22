# HabitHero 自主成長與成長回饋整合報告

**狀態：** Product integration draft  
**日期：** 2026-07-22  
**範圍：** 依照現有 React + Supabase 專案盤點，整合「孩子主動建立目標、家長確認/審核/鼓勵、成長回饋與統計」的新產品方向。  

## 1. 現有專案盤點

目前專案已具備雲端家庭任務 App 的主要骨架：

- 前端：Vite + React + TypeScript。
- 主要畫面：
  - `ChildDashboard`：孩子查看任務、完成任務、兌換獎勵、許願。
  - `ParentDashboard`：家長管理孩子、派發任務、模板、獎勵、許願與審核。
- 資料層：
  - `profiles`
  - `families`
  - `family_members`
  - `child_profiles`
  - `task_templates`
  - `tasks`
  - `rewards`
  - `wishlist_items`
  - `reward_redemptions`
  - `point_ledger`
- 任務狀態已存在：
  - `todo`
  - `pending`
  - `completed`
- 點數已透過資料庫函式發放，避免前端直接改餘額。
- 權限模型已區分家長與孩子，並透過 Supabase RLS 管理。

現況比較偏向傳統模型：

> 家長建立任務 -> 孩子完成 -> 家長核准 -> 發放點數

新產品方向應改成：

> 孩子提出今日目標 -> 家長確認與校準 -> 孩子完成並反思 -> 家長審核、批改與鼓勵 -> 累積成長紀錄

這不是推倒重做，而是在既有任務模型上補齊「目標來源、家長確認、提交證明、成長回饋、分類統計」。

## 2. 建議產品定位

HabitHero 不應只定位成任務/獎勵工具，而是：

> 一款讓孩子主動設定每日目標，家長陪伴確認、審核與鼓勵的自主成長 App。

核心差異化：

- 傳統 App：家長分配任務，孩子被動完成。
- HabitHero：孩子練習設定目標，家長協助把目標變具體、可完成、可回顧。

產品重點排序：

1. 自主性：孩子每天主動提出目標。
2. 校準：家長協助目標更清楚，不只是批准。
3. 反思：孩子完成後說明自己做了什麼。
4. 鼓勵：家長留下具體回饋，建立成就感。
5. 點數：作為輔助，不應成為唯一動機。

## 3. 任務是否需要固定種類

建議採用：

> 固定主類別 + 家庭自訂模板 + 可選標籤

不建議完全自由分類，原因是後續統計會失真。例如同一件事可能被不同家庭寫成「運動」「體能」「健康」「跑步」，報表很難比較。

也不建議完全固定任務，原因是每個家庭年齡、生活作息與教養重點差異很大。

### 3.1 固定主類別

建議第一版固定 6 個主類別：

| 類別 | 用途 | 示例 |
|---|---|---|
| `life_habit` 生活自理 | 日常責任與自我照顧 | 刷牙、整理書包、收玩具 |
| `learning` 學習成長 | 學科、閱讀、練習 | 閱讀 20 分鐘、練字、英文單字 |
| `health` 健康體能 | 運動、睡眠、飲食 | 跳繩、早睡、喝水 |
| `relationship` 人際與情緒 | 情緒管理、同理、溝通 | 好好說話、主動道歉、幫助手足 |
| `family_contribution` 家庭貢獻 | 家務與家庭參與 | 擦桌子、倒垃圾、摺衣服 |
| `creativity` 創造探索 | 藝術、興趣、探索 | 畫畫、做手作、觀察植物 |

這 6 類足夠支撐早期統計，也容易讓家長理解。

### 3.2 任務來源

任務需要記錄來源，這是產品差異化的關鍵。

建議增加 `task_origin`：

| 值 | 意義 |
|---|---|
| `child_proposed` | 孩子主動建立 |
| `parent_suggested` | 家長建議，孩子接受 |
| `parent_assigned` | 家長直接派發 |
| `system_template` | 系統推薦模板 |

首頁與報表應優先呈現 `child_proposed`，因為這是「自主成長」的核心指標。

### 3.3 任務模板

現有 `task_templates` 可以保留，但建議改成「目標模板庫」：

- 模板需有固定主類別。
- 模板可由家庭自訂。
- 模板可有預設點數、預設時長、建議證明方式。
- 孩子新增目標時，可從模板選，也可自由輸入。

## 4. 任務生命週期調整

現有 `todo -> pending -> completed` 不足以表示「家長確認」階段。

建議改成以下生命週期：

| 狀態 | 說明 | 主要操作人 |
|---|---|---|
| `draft` | 孩子正在建立，尚未送出 | 孩子 |
| `proposed` | 孩子已提出，等待家長確認 | 孩子 |
| `confirmed` | 家長已確認點數與目標內容 | 家長 |
| `submitted` | 孩子完成並提交證明/心得 | 孩子 |
| `revision_requested` | 家長要求補充或調整 | 家長 |
| `approved` | 家長通過，發放點數 | 家長 |
| `archived` | 歷史保留，不再顯示於今日清單 | 系統/家長 |

第一版若要避免改動太大，也可以先折衷：

- 既有 `todo` 暫時代表「家長已確認可執行」。
- 既有 `pending` 暫時代表「孩子已提交，等待審核」。
- 新增一個 `proposed` 狀態，處理孩子新增目標後等待家長確認。

建議最小可行改法：

```text
proposed -> todo -> pending -> completed
```

## 5. 成長回饋設計

成長回饋不應只是留言欄，應分成「孩子反思」與「家長回饋」兩種資料。

### 5.1 孩子完成提交

孩子完成任務時可提交：

- 完成勾選。
- 文字心得。
- 照片證明。
- 語音說明。
- 自評心情或難度。

建議第一版先做：

- `child_reflection_text`
- `child_mood`
- `child_difficulty`

照片與語音可放第二階段，因為會牽涉 storage、檔案權限、兒童隱私與審核成本。

### 5.2 家長審核與鼓勵

家長對已完成任務可以：

- 通過。
- 退回補充。
- 調整實際給點。
- 留鼓勵留言。
- 批改心得內容。
- 標記亮點。

建議家長回饋欄位：

| 欄位 | 說明 |
|---|---|
| `parent_feedback_text` | 家長鼓勵或回饋 |
| `parent_correction_text` | 批改/補充建議 |
| `approved_points` | 實際發放點數 |
| `reviewed_at` | 審核時間 |
| `reviewed_by` | 審核家長 |
| `feedback_tone` | 鼓勵、提醒、補充、表揚 |

回饋文案應引導家長具體描述行為，而不是只寫「很棒」。

好例子：

> 你今天不是只整理書包，還有自己檢查明天課本，這代表你有提前準備。

## 6. 建議資料模型擴充

### 6.1 `tasks` 增加欄位

建議新增：

```sql
category text not null default 'life_habit'
  check (category in (
    'life_habit',
    'learning',
    'health',
    'relationship',
    'family_contribution',
    'creativity'
  )),
origin text not null default 'parent_assigned'
  check (origin in (
    'child_proposed',
    'parent_suggested',
    'parent_assigned',
    'system_template'
  )),
confirmed_at timestamptz,
confirmed_by uuid references public.profiles(id),
submitted_at timestamptz,
reviewed_at timestamptz,
reviewed_by uuid references public.profiles(id),
approved_points integer,
child_reflection_text text,
child_mood text,
child_difficulty smallint check (child_difficulty between 1 and 5),
parent_feedback_text text,
parent_correction_text text,
feedback_tone text
```

### 6.2 任務附件表

照片與語音建議獨立成表，不塞在 `tasks`：

```sql
task_evidence (
  id uuid primary key,
  family_id uuid not null,
  task_id uuid not null,
  child_profile_id uuid not null,
  evidence_type text check (evidence_type in ('photo', 'audio')),
  storage_path text not null,
  created_at timestamptz not null
)
```

第一版可以先不做附件表，等文字心得流程跑順再加。

### 6.3 任務事件表

若未來要完整追蹤「誰改了什麼、何時退回、何時確認」，建議增加：

```sql
task_events (
  id uuid primary key,
  family_id uuid not null,
  task_id uuid not null,
  actor_profile_id uuid not null,
  event_type text not null,
  note text,
  created_at timestamptz not null
)
```

這對通知、審核歷史和親子對話很有用，但第一版不是必需。

## 7. 統計與報表設計

固定主類別的目的，是讓報表可以回答真正有價值的問題。

### 7.1 孩子視角

孩子應看到：

- 今天我主動設定了幾個目標。
- 今天完成了幾個。
- 連續完成幾天。
- 哪一類做最多。
- 本週最值得記住的一件事。
- 爸媽給我的鼓勵。

### 7.2 家長視角

家長應看到：

- 孩子主動提出目標的次數。
- 主動目標完成率。
- 家長派發任務完成率。
- 哪些類別穩定成長。
- 哪些類別長期缺少目標。
- 常被退回補充的任務類型。
- 家長回饋是否足夠具體。

### 7.3 核心指標

建議 MVP 優先做這些：

| 指標 | 用途 |
|---|---|
| 主動目標數 | 衡量孩子自主性 |
| 主動目標完成率 | 衡量承諾與執行 |
| 類別分布 | 看成長是否均衡 |
| 連續完成天數 | 培養節奏感 |
| 家長鼓勵次數 | 衡量親子互動 |
| 退回補充次數 | 看目標或證明是否不清楚 |

### 7.4 不建議早期使用的指標

暫時不建議做：

- 孩子之間排行榜。
- 全平台平均比較。
- 過度細的分數排名。
- 只用點數衡量成長。

這些容易把產品導向競爭與獎懲，而不是自主成長。

## 8. 通知設計

通知應圍繞任務生命週期：

| 觸發 | 收件人 | 文案方向 |
|---|---|---|
| 孩子新增目標 | 家長 | 孩子提出今日目標，請確認 |
| 家長未確認 | 家長 | 還有目標等待確認 |
| 家長確認 | 孩子 | 目標已確認，可以開始 |
| 孩子提交完成 | 家長 | 有完成項目等待審核 |
| 家長退回補充 | 孩子 | 爸媽希望你再補充一點 |
| 家長通過留言 | 孩子 | 收到爸媽的鼓勵 |

MVP 可先做 App 內通知/紅點，真正推播可放後續。

## 9. MVP 建議範圍

第一階段建議做：

1. 孩子可以新增今日目標。
2. 目標必須選固定主類別。
3. 目標來源記為 `child_proposed`。
4. 家長可以確認、調整點數、退回修改。
5. 孩子完成後提交文字心得與自評難度。
6. 家長審核時可以留言鼓勵或批改。
7. 通過後才寫入 point ledger。
8. 孩子與家長都能看到簡單成長紀錄。
9. 週報先做最小版：完成數、主動目標數、類別分布、家長鼓勵摘要。

不建議 MVP 做：

- 語音附件。
- 照片附件。
- AI 自動批改。
- 複雜月報 PDF。
- 社群、排行榜。
- 多家庭公開模板市場。

## 10. 畫面調整建議

### 10.1 孩子首頁

目前孩子首頁是「我的任務」。建議改成「今天我想完成」。

新增主要入口：

- 新增今日目標。
- 從模板選一個目標。
- 自己寫一個目標。

任務分區：

- 等爸媽確認。
- 今天要做。
- 已送出，等審核。
- 今天完成了。

### 10.2 家長首頁

目前家長首頁主要是任務管理。建議首頁改為審核中心：

- 待確認目標。
- 待審核完成。
- 待兌現獎勵。
- 本週成長摘要。

任務管理與模板庫可以保留為次要 tab。

### 10.3 任務詳情頁

任務詳情會成為核心互動頁，需要包含：

- 目標內容。
- 類別。
- 來源。
- 點數。
- 家長確認紀錄。
- 孩子心得。
- 家長回饋。
- 狀態時間線。

## 11. 與現有架構的整合路線

建議分三步做，避免一次改太大。

### Step 1：資料合約先行

- 擴充 `TaskStatus`。
- 增加固定 `TaskCategory`。
- 增加 `TaskOrigin`。
- 在 `TaskRow` / `TaskViewModel` 增加成長回饋欄位。
- 補資料轉換測試。

### Step 2：DB migration 與資料存取層

- 新增 tasks 欄位。
- 調整 RLS：孩子可以 insert 自己的 `child_proposed` 任務，但不能自己確認或給點。
- 新增 parent confirm/reject/review RPC。
- 保持 approve 後才寫入 `point_ledger`。

### Step 3：前端流程

- ChildDashboard 增加「新增今日目標」。
- ParentDashboard 增加「待確認目標」。
- 完成任務時加心得與難度。
- 審核任務時加鼓勵/批改留言。
- 增加簡單成長紀錄 tab。

## 12. 產品決策建議

建議現在先定案以下決策：

1. 任務主類別固定 6 種。
2. 任務仍允許自由輸入名稱。
3. 任務模板仍由家長管理，但孩子也可以從模板建立目標。
4. 孩子主動目標需要家長確認後才正式進入今日任務。
5. 家長可以調整點數，但需要保留原始孩子提案內容。
6. 完成任務必須至少支援文字心得。
7. 點數只在家長審核通過後發放。
8. 報表以「自主性、完成率、類別分布、親子回饋」為主，不以點數排行為主。

## 13. 推薦結論

任務需要有固定種類，否則未來很難做可靠統計；但固定的應該是「主類別」，不是每一個任務名稱。

最適合 HabitHero 的設計是：

> 孩子自由寫目標，但必須選一個固定主類別；家長可以協助修改內容與點數；完成後孩子提交心得，家長留下具體鼓勵。報表根據固定主類別、任務來源與完成狀態產生。

這樣可以同時保留孩子自主性、家庭彈性與後續統計能力。
