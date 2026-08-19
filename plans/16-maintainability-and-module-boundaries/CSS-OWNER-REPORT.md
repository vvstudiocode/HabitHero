# Plan 16 CSS selector owner 與證據報告

> 盤點日期：2026-08-20（Asia/Taipei）
> 依據：`CSS_RULES.md`、`src/styles/index.css` 與目前 component selector 使用情況

這份報告只記錄 owner、cascade 風險與尚缺的 visual evidence。沒有 browser QA 授權與 before screenshots 前，不搬移、刪除或覆蓋任何 CSS 規則。

## Import 與現況規模

`src/styles/index.css` 目前依序載入 `modals.css`、`character.css`、`world.css`、`overlays.css`（另有 tokens/base/forms/neutral/page layers）。後載入檔案可能改變同 selector 的 computed style，因此不能只依檔案順序刪除重複規則。

目前四個主要 CSS 熱點：

| 檔案 | 行數 | 初步責任 | 狀態 |
| --- | ---: | --- | --- |
| `src/styles/modals.css` | 1,736 | modal 內容與 modal 內元件 | owner 保留；待分 surface |
| `src/styles/character.css` | 1,476 | 角色首頁幾何、選單、responsive | owner 保留；高敏感 |
| `src/styles/world.css` | 1,022 | 3D 世界、商店、背包、設定 | owner 保留；含合法 breakpoint 覆蓋 |
| `src/styles/overlays.css` | 842 | overlay、drawer、遮罩與層級 | owner 保留；與 character 有重複需核對 |

## 需要先核對的跨檔 selector

- `.hh-parent-feature-overlay`、`.hh-parent-feature-backdrop`、`.hh-parent-feature-modal`、`.hh-parent-feature-close`：`character.css` 與 `overlays.css` 都有規則；`.hh-parent-feature-modal` 的 padding 不同。
- `.hh-parent-content-modal`、scrollbar、`.hh-parent-content-modal-bar`、sprite theme：`character.css` 與 `overlays.css` 都有規則；`overlays.css` 另有 `touch-action: pan-y`。
- `.hh-parent-content-modal` 與 bar 的 neutral surface：`modals.css` 另有既有 `!important` neutralization；實際 computed style 必須以瀏覽器確認。
- `.hh-toast`：`modals.css` 管 animation，`overlays.css` 管 fixed/safe-area 位置；先確認是同一 surface 的兩種責任，不能直接合併或刪除。
- `.hh-adventure-reward-*`：`modals.css` 與 `overlays.css` 都有相近命名；需用 component 使用點確認 content owner 與 layer owner。

## 建議拆分順序（尚未執行）

1. 先以 selector-owner 表逐項確認唯一 owner，記錄 import order、specificity、computed style 與使用 component。
2. 每次只處理一個 visual surface；先移除重複規則，再在原 owner 保留完整 state/responsive 規則。
3. 對 `hh-character-menu`、角色統計與 mobile 覆蓋分開處理；不能與 parent modal 或 world panel 同批。
4. 對 `modals.css` 依 adventure reward、item lightbox、new child、documents/settings、decoration purchase choice 分批處理。
5. 對 `world.css` 保留既有 `760px` breakpoint，先確認 game panel/catalog/editor 的 owner，再做小批搬移。

## 尚缺的 visual/device evidence

在任何 CSS extraction 前，需保存 before/after：

- `375x709` 與 `1440x900`：default、hover、pressed、selected、focus-visible。
- touch：`hover: none` + `pointer: coarse`，尤其 character menu 與 floating controls。
- parent feature/content modal：padding、safe-area、bar touch scrolling 的 computed style。
- toast：child clean mode 與 safe-area 下的位置。
- `prefers-reduced-motion: reduce`：menu、feature modal、adventure overlay、reward animation。

本次未啟動 dev server 或 browser，以上項目保持 `M/B`，不可用 `npm test` 取代。取得證據後，依 `CSS_RULES.md` 的 owner、cascade、touch target 與驗證流程逐 surface 建立獨立 commit。
