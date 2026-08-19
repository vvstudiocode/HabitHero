# Plan 16 行為基線與驗收矩陣

> 初始基線日期：2026-08-20（Asia/Taipei）
> 初始基線 commit：`b24a93fad25f8b20b932d00d21a253d2ee543d20`（`“codexainewok16“`）
> 工作分支：`codex/deploy-all-worktree`
> 目的：在任何 extraction 前保存可重跑的 automated evidence，並誠實標出尚未取得的 visual／device evidence。

> 目前程式驗證快照：`f46cf9b`（child row assembly extraction 完成；文件與治理 ratchet 另以後續 commit 同步）。初始基線仍保留作為所有 before 比較點；每個 extraction 的 exact commit 與 rollback 見下方 ledger。

## 1. 工作區與版本證據

- 初始確認時 `HEAD` 與 `origin/codex/deploy-all-worktree` 都指向 `b24a93f`。
- 後續只在本地建立可單獨 revert 的 Plan 16 extraction commits；沒有 push、deployment、remote migration、GLB、metadata 或外部服務變更。
- `b24a93f` 是可回復的重構前 checkpoint，不是資料庫、部署、遠端服務或使用者資料的備份。
- 目前最大的既有熱點與 exact line baseline 由 [`docs/code-maintainability.md`](../../docs/code-maintainability.md) 與 `scripts/check-source-size.mjs` 維護；本文件不複製另一份數字。

## 2. Automated baseline

所有命令均在本地 working tree 依序執行；除 build 的既有 chunk-size warning 外，exit code 如下：

| Command | Result | Evidence |
| --- | --- | --- |
| `npm run lint` | PASS (0) | TypeScript `tsc --noEmit` |
| `npm test` | PASS (0) | 712 tests、77 suites、712 pass、0 fail |
| `npm run build` | PASS (0) | Vite 1,870 modules transformed；既有大 chunk warning 已記錄，非本次行為差異 |
| `npm run security:check` | PASS (0) | 914 files scanned |
| `npm run quality:structure` | PASS (0) | 158 source files；146 import-boundary files；無 baseline growth／未審核超限檔 |
| `git diff --check` | PASS (0) | 無 whitespace error |
| Markdown local-link scan | PASS | Node read-only scan over project Markdown excluding generated `node_modules/`, `dist/`, `build/`, `.git/` and iOS DerivedData（本次 working tree 45 files）；未找到遺失 local target |
| `wc -c public/assets/pets/nibus.glb` | PASS | `1327240` bytes；目前 test／migration expectation 已一致 |

若後續重跑發現 Nibus `modelBytes` mismatch，先重新讀 GLB bytes、test 與最後有效 migration；只有證明 assertion／文件過時才可修正，不能重匯、調 metadata 或改 published migration。

## 3. 行為矩陣

### 狀態欄位

- `A` = automated contract／unit evidence 已由完整 suite 覆蓋。
- `M` = 尚需固定操作與人工紀錄；本次未啟動 dev server，不能宣稱完成。
- `B` = 需要瀏覽器／真機授權或 release context，保持 blocked。

| 領域 | 目前基線 | Automated evidence | 尚缺的 before evidence／下一步 |
| --- | --- | --- | --- |
| Auth／身份 | A + M | auth validation、session、login／password recovery contracts | M：瀏覽器登入、登出、refresh、孩子切換與權限錯誤的固定 viewport recording |
| 家長流程 | A + M | dashboard、task、reward、child-account、point-ledger contracts | M：新增／編輯／刪除、核准／退回與設定流程的操作矩陣 |
| 孩子流程 | A + M | adventure、timer、wishlist、reward、notification contracts | M：今日／一般冒險、完成、兌換與離線恢復的畫面證據 |
| 資料同步 | A | realtime、offline queue、optimistic rollback、revision／idempotency contracts | M：雙分頁／網路中斷手動時序；不可只用 unit test 代替 |
| 遊戲經濟 | A + M | purchase、inventory、placement、catalog contracts | M：商店／背包／購買／裝備／寵物／裝飾固定場景 |
| 3D 人物／寵物 | A + M | asset/metadata、animation、following、roaming、grounding、shadow／label、runtime geometry、resource dispose/abort contracts | M：固定 seed 的 Idle／Walk／stop／turn／follow／wander；visual、Web、high/low quality 未執行 |
| UI／CSS | A + M | UI behavior、mobile interaction、theme、safe-area contracts | M：375×709、1440×900、focus／hover／pressed／reduced-motion screenshot；未獲 browser 授權保持 blocked |
| 音訊／通知 | A + M | background music、completion audio、push preference contracts | M：面板切換、頁面離開、裝置通知權限操作 |
| 平台 | A | mobile-release contract 與 source checks | B：iOS／Android 真機、`cap:sync`、release key、上架；本次未執行 |

## 4. Golden baseline 使用規則

1. 任何 Plan16 extraction 先選一個領域，補齊該列的 M／B evidence，再在舊實作上跑一次 automated suite。
2. before evidence 要保存操作前置、輸入／輸出、side effect、錯誤文字、event order、animation／ground／shadow／follow state 與 artifact path；不能只寫「看起來正常」。
3. 沒有 browser／device 授權時，visual／真機欄位保持 `M` 或 `B`，不得用 `npm test` 代替。
4. Plan17 是獨立 docs-only canonical pet process；本基線不授權調整現有 pet runtime、GLB、metadata、exporter、migration 或 tests。
5. 每個 extraction 只改一個 responsibility，保存 before／after 結果與精確 revert commit；任一無法解釋差異都停止。

## 5. Extraction ledger 與當前 gate 結論

- Plan16 Phase 0 automated baseline：**PASS**。
- Plan16 Phase 1 governance：**PASS**（`docs/code-maintainability.md`、source-size 與 import-boundary checks）。
- Plan16 Phase 2/3 低風險 extraction：**PASS**。以下 commits 均先補 characterization/contract tests，再做單一責任、保留 facade 的 mechanical extraction：
  - `42f9aa7` / `64a355b`：world RPC mapper contracts → `world-data-access.ts`。
  - `4f23fa7`：runtime camera config contract 改為 public behavior contract。
  - `9f41ff0`：runtime geometry constants/helpers → `world-runtime-geometry.ts`。
  - `cb4bbf0` / `5cb5783`：GLTF/resource lifecycle contracts → `world-runtime-resources.ts`；runtime `2834 → 2672` 行。
  - `1f8ee4b` / `f107dac`：store optimistic task-id patch contracts → `app-state-patches.ts`。
  - `e34a3d4` / `bdd089c`：timer snapshot merge contracts → `app-state-patches.ts`。
  - `9a79f55` / `d11eabf`：growth payload contracts → `growth-data-access.ts`；data-access `882 → 778` 行。
  - `efb97ba` / `69ec0ff`：child-account/point-ledger payload builders；data-access `778 → 761` 行。
  - `7b58e85` / `4280858`：point-ledger adjustment result mapper → `point-ledger-data-access.ts`；data-access `761 → 752` 行。
  - `6daea54` / `b8b11e7` / `5e713e0`：world asset URLs/decoration metadata helpers 與 owner contract → `world-runtime-assets.ts`；runtime `2672 → 2648` 行。
  - `4bea19c`：`types.ts` split into primitive/database/write/view/legacy modules with type-only facade。
  - `356452b` / `fe954c8`：store pure `patchChild`／`patchTask`／`patchGameData` contracts → `app-state-patches.ts`；store `995 → 962` 行。
  - `e81713f` / `b92ea7d` / `f46cf9b`：child row assembly contracts → `child-data-access.ts`；data-access `752 → 730` 行。
- Plan16 Phase 5 remaining high-risk areas：**保留 baseline / blocked**。Parent/Child dashboards、provider side effects、repository hydration/facade、character/pet/decoration controllers、frame loop、CSS require additional state/visual/device evidence before further extraction。
- Plan16 CSS owner report：**PASS（盤點完成）**，見 [`CSS-OWNER-REPORT.md`](./CSS-OWNER-REPORT.md)；未搬 selector、未新增 override。
- Plan17 docs-only：**PASS**；現有寵物呈現、runtime、GLB、exporter、metadata、migration、tests 與外部狀態均未修改。

### 5.1 Current line and dependency evidence

Current ratcheted hotspots include `prototype-world-runtime.ts` 2,648 lines, `data-access.ts` 730 lines, `store.tsx` 962 lines, and `types.ts` is now an 11-line type-only facade. All new domain modules are below the 300-line warning threshold. `npm run quality:structure` and import-boundary checks are green at the current snapshot. No browser/device evidence was generated; this is an explicit remaining gate, not an implied pass.
