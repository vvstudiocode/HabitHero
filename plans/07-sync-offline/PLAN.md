# 07 即時同步、重試與離線狀態

## 目標

支援家長與孩子分別使用不同裝置時，任務審核與點數變更能被重新查詢或即時反映，並在網路不穩時避免資料遺失或重複提交。

## 依賴

05 家長端、06 孩子端、04 provider。

## 允許修改

- `src/lib/` 的 realtime/sync/retry 模組
- provider/hooks
- 必要的 dashboard 元件狀態 UI
- 對應測試

## 工作內容

- 只訂閱目前 authenticated user 可存取的家庭資料，清理 channel 與 session 變更。
- mutation 使用 request state、idempotency 或 server constraint 避免重複點擊造成重複副作用。
- 網路失敗時標示 stale/offline，提供 retry；不得把未確認的 mutation 當作已完成。
- reconnect 後重新 fetch authoritative state。
- 不把複雜的離線寫入佇列當成本階段預設；若實作，必須定義衝突與清除策略。

## Acceptance Criteria

- AC-01：A 裝置核准任務後，B 裝置在 realtime 或重新整理後顯示相同 server state。
- AC-02：重複點擊 approve/redeem 不會重複入帳、扣款或建立紀錄。
- AC-03：斷網期間 UI 清楚顯示未同步，恢復網路後可重試並以 server state 校正。
- AC-04：登出、換家庭、元件卸載時 realtime subscription 不殘留。
