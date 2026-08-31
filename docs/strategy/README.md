# HabitHero 策略與架構圖工作區

這個目錄只回答產品與遊戲設計問題：

- 為什麼要做這個功能？
- 它為誰解決什麼問題？
- 它和其他功能怎麼互相影響？
- 現在不做什麼？以後才做什麼？

它不取代 `plans/`。`docs/strategy/` 定義「做什麼與為什麼」，`plans/` 才定義「怎麼實作與怎麼驗收」。

## 三種圖的固定分工

### Markmap：發散與階層

`01-product-mindmap.md` 使用一般 Markdown 標題與清單。它適合整理：

- 產品目的
- 使用者
- 功能樹
- 遊戲內容
- 劇情層級
- VIP 價值分類

預覽指令：

```bash
npm run docs:mindmap
```

輸出會放在 `docs/strategy/rendered/product-mindmap.html`。這個輸出檔是暫時產物，不提交 Git。

### Mermaid：正式關係與流程

`02-product-architecture.md`、`03-vip-system.md` 和 `04-future-roadmap.md` 裡的 Mermaid 區塊，適合整理：

- 使用者流程
- 系統邊界
- 功能依賴
- VIP 權限判斷
- 遊戲核心循環
- 未來階段

GitHub 會直接渲染 Markdown 中的 Mermaid。不要把精確價格、上限或方案條款只放在圖中；圖表達關係，Markdown 表格保存精確資料。

### Excalidraw：自由草稿

`drafts/habithero-brainstorm.excalidraw` 是可以用 Excalidraw 開啟的起始白板。它適合：

- 還沒整理的想法
- 快速畫箭頭和圈選
- 放參考圖片
- 討論 UI 或遊戲場景

Excalidraw 草稿不是正式規格。討論結束後，把已確認的內容整理回 Markdown、Markmap 或 Mermaid，避免白板和文件分叉。

## 狀態標記

每個想法都使用以下其中一種狀態：

- `[決定]`：已確認，後續實作應遵守
- `[待討論]`：目前需要產品決策
- `[想法]`：可以研究，但不代表承諾
- `[不做]`：明確排除，避免重複提案

若決定改變，保留舊文字並標記 `[不做]`，再新增新的 `[決定]`，讓 Git 歷史能看出方向為什麼改變。

## 以後和 Codex 一起使用

你可以直接說：

```text
先不要寫程式，請更新 docs/strategy/01-product-mindmap.md，加入我剛剛說的 VIP 想法。
```

或：

```text
根據 strategy 裡的圖，檢查這個新功能是否和現有產品方向衝突，先只回報不要修改。
```

確認方向後再說：

```text
把已決定的 VIP 流程轉成一份 implementation plan，但先不要改程式。
```

最後才進入：

```text
依照已決定的圖和 plan 開始實作，先列出會修改的檔案。
```

## 建議順序

1. 更新 Markmap，收集想法。
2. 把想法標成 `[決定]`、`[待討論]` 或 `[不做]`。
3. 用 Mermaid 畫出決定後的流程與依賴。
4. 用 Markdown 表格記錄價格、權限、上限和例外情況。
5. 把完成的方向轉成 `plans/` 裡的技術計畫。
6. 技術計畫確認後才修改 `src/`、Supabase 或資產。
