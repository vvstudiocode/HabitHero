# Plan 16 CSS selector owner 與證據報告

> 盤點日期：2026-08-20（Asia/Taipei）
> 依據：`CSS_RULES.md`、`src/styles/index.css` 與目前 component selector 使用情況

這份報告只記錄 owner、cascade 風險與尚缺的 visual evidence。沒有固定 viewport browser QA 與 before screenshots 前，不搬移、刪除或覆蓋任何 CSS 規則。2026-08-20 已有一次使用者預先啟動 localhost 分頁的 read-only smoke，可作為「頁面未明顯空白／主入口可開」的輔助證據；它不是 375x709／1440x900 computed-style baseline。

## 可重跑的唯讀 evidence 指令

以下指令只讀檔案，可在任何 CSS 搬移前重跑並貼回本報告：

```bash
wc -l src/styles/modals.css src/styles/character.css src/styles/world.css src/styles/overlays.css
sed -n '1,40p' src/styles/index.css
rg -n '!important|override|final|fix|nth-child|@media|:focus|:hover|:active|:focus-visible|pointer: coarse|hover: none' src/styles/modals.css src/styles/character.css src/styles/world.css src/styles/overlays.css
rg -n 'hh-parent-feature|hh-parent-content-modal|hh-game-item-lightbox|hh-adventure-detail|hh-adventure-reward|hh-toast|hh-decoration-purchase-choice|hh-character-menu|hh-game-' src/styles/modals.css src/styles/character.css src/styles/world.css src/styles/overlays.css
```

若要重跑跨檔重複 selector 掃描，用下面的 read-only Node script；它不寫檔：

```bash
node - <<'NODE'
const fs = require('fs');
const files = [
  'src/styles/modals.css',
  'src/styles/character.css',
  'src/styles/world.css',
  'src/styles/overlays.css',
];
const selectors = new Map();
for (const file of files) {
  fs.readFileSync(file, 'utf8').split(/\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('@') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return;
    if (!trimmed.includes('{')) return;
    for (const part of trimmed.slice(0, trimmed.indexOf('{')).split(',')) {
      const selector = part.trim();
      if (!selector) continue;
      const locations = selectors.get(selector) || [];
      locations.push(`${file}:${index + 1}`);
      selectors.set(selector, locations);
    }
  });
}
for (const [selector, locations] of [...selectors.entries()].filter(([, value]) => value.length > 1)) {
  console.log(selector);
  for (const location of locations) console.log(`  ${location}`);
}
NODE
```

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

- `.hh-parent-feature-overlay`、`.hh-parent-feature-backdrop`、`.hh-parent-feature-modal`、`.hh-parent-feature-close`：`character.css:1025` 到 `1130` 與 `overlays.css:162` 到 `267` 都有規則；`.hh-parent-feature-modal` 的 top safe-area padding 不同，`character.css` 使用 `max(34px, env(safe-area-inset-top))`，`overlays.css` 使用 `max(70px, calc(env(safe-area-inset-top, 0px) + 24px))`。
- `.hh-parent-content-modal`、scrollbar、`.hh-parent-content-modal-bar`、sprite theme：`character.css:1172` 到 `1247` 與 `overlays.css:309` 到 `399` 都有規則；`overlays.css:318` 另有 `touch-action: pan-y`，bar padding 也與 `character.css` 不同。
- `.hh-parent-content-modal` 與 bar 的 neutral surface：`modals.css:1568` 到 `1600` 另有既有 `!important` neutralization；但 `overlays.css` 在 `index.css` 中較晚載入，實際 computed style 必須以瀏覽器確認。
- `.hh-toast`：`modals.css:124` 管 animation，`overlays.css:788` 與 `overlays.css:813` 管 fixed/safe-area 位置；先確認是同一 surface 的兩種責任，不能直接合併或刪除。
- `.hh-adventure-reward-*`：`modals.css:145` 起定義 reward card 內容與 totals，`overlays.css:474` 起定義 reward overlay/layer/sparkles；命名相近但看起來分屬 content owner 與 overlay owner，需用 component 使用點確認。
- `.hh-game-item-lightbox*` 與 `.hh-game-lightbox*`：集中在 `modals.css:567` 到 `798`，但引用 `.hh-game-action-button` 這類 world game button class；搬移前要確認 lightbox 是否仍歸 modal content owner，而不是 world panel owner。
- `.hh-character-menu*`：集中在 `character.css:384` 到 `840`，包含 root action、submenu、parent/child variants、backpack collapsed/open state 與大量 `nth-child` 幾何／delay 規則；這一段是角色首頁互動幾何，不能在沒有 screenshot/computed-style baseline 時移動。

## 建議拆分順序（尚未執行）

1. 先建立 selector-owner 表，逐項記錄唯一 owner、import order、specificity、computed style、使用 component 與 before screenshot artifact。
2. 第一個 CSS surface 建議只選 parent feature/content modal duplicated selectors，因為跨檔重複最明確；仍須先有 fixed viewport baseline，且只能保留一個 owner，不得以新增 override 修正。
3. `hh-character-menu`、角色統計與 mobile 覆蓋分開處理；不能與 parent modal 或 world panel 同批。`nth-child` 目前是合法幾何 contract，沒有替代 modifier class 與 screenshot evidence 前不得改。
4. `modals.css` 依 adventure reward、item lightbox、new child、documents/settings、decoration purchase choice 分批處理。
5. `world.css` 保留既有 `760px` breakpoint，先確認 game panel/catalog/editor 的 owner，再做小批搬移。responsive 重複是合法 state，不得用重複掃描批次刪除。

## 當前 CSS gate 結論

- CSS owner report：PASS，已列出四個熱點、跨檔 selector 風險與可重跑掃描方式。
- CSS 搬移／刪除／合併：BLOCKED，缺固定 viewport before screenshots 與 computed-style baseline。
- 允許的下一步：只建立 browser evidence，不修改 CSS。建議 artifact 至少包含 parent feature modal、parent content modal、toast、character menu、world game panel 的 `375x709` 與 `1440x900` default/focus/hover/active/reduced-motion 截圖與 computed style。
- 禁止的下一步：批次搬 `hh-parent-*`、刪除 `!important` neutralization、重排 `index.css` import、格式化整份 CSS、用新 override 覆蓋現有差異。

## 尚缺的 visual/device evidence

在任何 CSS extraction 前，需保存 before/after：

- `375x709` 與 `1440x900`：default、hover、pressed、selected、focus-visible。
- touch：`hover: none` + `pointer: coarse`，尤其 character menu 與 floating controls。
- parent feature/content modal：padding、safe-area、bar touch scrolling 的 computed style。
- toast：child clean mode 與 safe-area 下的位置。
- `prefers-reduced-motion: reduce`：menu、feature modal、adventure overlay、reward animation。

本輪 CSS owner 工作沒有啟動 dev server、沒有修改 CSS、沒有建立 before/after visual baseline。既有 localhost read-only smoke 只證明主入口可讀取／可切換，不足以解除 CSS extraction gate；以上項目保持 `M/B`，不可用 `npm test` 取代。取得證據後，依 `CSS_RULES.md` 的 owner、cascade、touch target 與驗證流程逐 surface 建立獨立 commit。
