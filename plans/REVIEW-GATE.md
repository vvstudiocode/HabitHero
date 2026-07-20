# 總指揮審核 Gate

每一個子 agent 交付後依序檢查：

## Gate A：範圍

- 是否只修改該任務允許的檔案？
- 是否把未決產品問題偷偷做成固定行為？
- 是否將 09/10 的部署或上架工作提前執行？

## Gate B：型別與行為

- `npm run lint` 是否通過？
- mutation 是否有明確錯誤、loading、retry 狀態？
- 既有任務狀態、家長核准與獎勵兌換語意是否保持？

## Gate C：安全與資料

- 是否使用 service-role key、明文密碼或真實兒童資料？
- 授權是否以資料庫 membership/ownership 與 RLS 為準？
- 點數是否只能經由受控 transaction/RPC 變更？
- 是否有跨家庭、跨孩子、未登入測試證據？

## Gate D：整合

- 是否說明對前置與後續任務的影響？
- 是否新增未記錄的 API、環境變數或 migration？
- 是否能在下一個任務的固定輸入下繼續工作？

## 決策

- `PASS`：所有 required AC 通過，且沒有高風險未解問題。
- `PASS WITH FOLLOW-UP`：不阻擋下一任務的小問題已記錄。
- `BLOCKED`：安全、資料正確性、授權或必要依賴未通過；退回原子 agent 修正。

未通過時不直接改寫子 agent 的大段程式碼；先以具體檔案、行為與驗收證據退回。
