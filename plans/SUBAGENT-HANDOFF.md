# 子 agent 派工模板

請只執行指定任務，不要順手處理其他編號。

## 任務

- 任務編號：`XX`
- 讀取：`plans/00-overview.md`、`plans/XX-*/PLAN.md`、`AGENTS.md`
- 依賴輸出：列出已完成的前置任務與檔案
- 工作目錄：`/Users/studio.vv/Desktop/HabitHero`

## 邊界

- 允許修改：完全依照該任務 `PLAN.md`
- 禁止修改：其他任務資料夾、部署、上架、秘密與生產資源
- 發現跨任務需求：停止該部分，回報總指揮，不自行擴大範圍

## 交付回報

```text
任務：XX
修改檔案：
- path/to/file

Acceptance Criteria：
- AC-001: PASS/FAIL - evidence

驗證命令與結果：
- command: result

未完成項目：
- none / reason

風險與後續依賴：
- none / details
```

## 總指揮審核原則

- 先看 diff 與型別，再看測試結果；不以「測試通過」取代人工審核。
- 檢查是否觸碰禁止範圍、是否引入秘密、是否繞過 RLS 或把授權放在前端。
- 檢查錯誤與 loading 狀態是否完整，是否破壞既有 domain 行為。
- 通過後才把索引中的任務狀態改為完成，並派發下一個依賴任務。
