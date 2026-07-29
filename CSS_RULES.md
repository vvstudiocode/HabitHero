# HabitHero CSS Rules

這份文件是 HabitHero 的 CSS 唯一維護規則。任何 AI 或開發者修改樣式前，必須先閱讀本文件與 `AGENTS.md`。

## 1. 樣式檔案責任

每一種責任只有一個 owner，禁止把同一個元件的規則散落到多個檔案，再用後面的 selector 覆蓋前面的 selector。

| 檔案 | 只負責 | 不要放在這裡 |
| --- | --- | --- |
| `src/styles/tokens.css` | 顏色、間距、尺寸、陰影等變數 | 元件 selector、響應式覆蓋 |
| `src/styles/base.css` | reset、body、全域基礎排版與共用 utility | 特定頁面或元件的定位 |
| `src/styles/character.css` | 家庭冒險角色首頁、主按鈕、展開選單、icon button 的尺寸與位置 | 全域主題覆蓋、modal 規則 |
| `src/styles/neutral-theme.css` | 中性主題的表面色、文字色、邊框與陰影 | 角色首頁的幾何位置與 responsive layout |
| `src/styles/overlays.css` | overlay、drawer、modal 遮罩與層級 | hero、主按鈕、展開選單 |
| `src/styles/forms.css` | 共用表單欄位、label、錯誤狀態 | 角色首頁按鈕 |
| `src/styles/modals.css` | modal 內容與 modal 內元件 | 首頁 layout |
| `src/styles/login.css` / `dashboard.css` | 各自頁面的專屬 layout | 其他頁面的補丁 |

`src/styles/index.css` 的 import 順序也是層級契約：token → base → 共用元件 → 頁面 → character → overlay。除非有明確架構原因，不要任意調換順序。

## 2. 修改前先找 owner

1. 先用 `rg` 搜尋現有 class 與 custom property。
2. 找到該 selector 的 owner 檔案後，直接修改原規則。
3. 若原規則已過時，刪除它，不要在檔案最底部新增「最後覆蓋」或 `!important`。
4. 同一 selector 的同一責任只保留一份；同一 breakpoint 只保留一個集中區塊。

不確定規則應該放哪裡時，先停下來整理現有 cascade 並說明，不要猜測後追加 CSS。

## 3. 變數與 layout

重複出現的尺寸、間距與定位必須使用 custom property，避免不同檔案各自寫一組數字。目前角色首頁的 canonical variables 是：

```css
--hh-character-content-left
--hh-character-copy-top
--hh-menu-action-size
--hh-menu-submenu-gap
--hh-menu-submenu-offset
```

角色首頁的左上統計與標題必須共用 `--hh-character-content-left`；手機為 `12px`，桌面為 `28px`。展開選單的第一個子按鈕必須透過 `--hh-menu-submenu-offset` 與主按鈕保持距離，不可另寫一組 magic number。

響應式只沿用現有 `760px` 與 `390px` 斷點。單一視覺問題不得另創 breakpoint；手機專屬的角色首頁調整集中在 `character.css`。

## 4. 按鈕狀態與視覺契約

- 角色首頁主按鈕、icon button、展開子按鈕的 default、hover、pressed/selected 必須維持同一幾何位置。
- 主題色光圈是設計狀態的一部分；家庭使用暖金／琥珀色，孩子使用人物代表色。未 hover、hover、點擊/選取都要保留，不得只在 `:hover` 才出現。
- 不得加入黑色線條、灰色外框或 hover 時突然出現的白色/黑色邊框。
- 不得在 hover 改變按鈕尺寸、位置、`border-width` 或造成 layout shift。
- 觸控裝置（`hover: none` + `pointer: coarse`）停用 `hh-menu-float`；手機瀏覽器不要用會改變 layout 的 `margin` 動畫讓按鈕漂浮。
- 鍵盤操作只用 `:focus-visible` 提供清楚的 focus cue，不要用 `outline: none` 消除可及性提示。
- 可點擊控制項的實際 touch target 維持至少 `44px`。

角色首頁按鈕的 theme 色彩與陰影由 `neutral-theme.css` 管理；尺寸、位置與選單排列由 `character.css` 管理。generic button 規則若會影響角色首頁，必須用排除 selector 保護角色首頁控制項。

## 5. Cascade、border 與 `!important`

- 優先使用低 specificity、單一 class selector；不要用深層巢狀 selector、`nth-child` 或 tag selector 增加覆蓋競賽。
- `nth-child` 只有在選單順序是穩定且確實代表 layout 位置時才可保留；若是語意狀態，改用 modifier class。
- 一個元件只定義一套主要 shadow。不要在不同檔案疊加白色 ring、灰色 border 與粉色 glow。
- 新增 `!important` 前必須先確認 owner、import order 與 specificity；一般元件規則禁止使用。若是既有 global theme neutralization 的必要例外，必須在同一行或上一行註明原因。
- 禁止用空 selector、重複整段 responsive block、或「fix/final/override」命名的補丁區塊掩蓋架構問題。

## 6. 變更流程

每次 CSS 修改都遵循：

1. 記錄要修的 selector、狀態、viewport 與預期結果。
2. 搜尋並修改唯一 owner；必要時同步刪除過時規則。
3. 在手機 `375x709` 與桌面 `1440x900` 檢查 overflow、對齊、default、hover、selected、keyboard focus。
4. 檢查 computed style，確認沒有被其他檔案或更高 specificity 偷換。
5. 執行以下檢查：

```bash
npm run lint
npm test
npm run build
npm run security:check
git diff --check
```

若只是文件或註解變更，至少執行 `git diff --check`；若改到 CSS 或元件，應執行完整檢查。

## 7. 提交前 checklist

- [ ] 沒有把同一 selector 複製到第二個檔案。
- [ ] 沒有新增無必要的 `!important`、magic number 或 breakpoint。
- [ ] 沒有讓 hover/pressed 產生位置、尺寸或邊框跳動。
- [ ] 角色首頁左上統計與標題仍共用同一左側變數。
- [ ] 展開選單第一個子按鈕仍由 submenu offset 控制，沒有擋住主按鈕。
- [ ] 沒有黑色/灰色外框，當前主題色光圈在未 hover 狀態仍存在。
- [ ] diff 只包含這次需求相關的檔案與規則。

核心原則：先整理 cascade，再改規則；先修改 owner，再驗證結果；不要用更多 CSS 覆蓋問題。
