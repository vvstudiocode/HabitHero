# HabitHero 寵物五個 FBX 整合規則與單一文件計畫

## 1. 已鎖定的產品決策

現有寵物呈現全部正確，包括：

- Idle、Walk、Sit、Wave、Dance 動作。
- 跟隨、巡遊、停止、轉向與互動狀態。
- 模型大小、腳底與草地接觸位置。
- 真實模型陰影、runtime contact marker 與名稱位置。
- 現有 catalog metadata、GLB、exporter、runtime 與 migration 所形成的實際結果。

本任務不是修寵物、重匯資產或重構 runtime。本任務只建立一份未來 AI 可遵循的 canonical 流程，確保下一次把五個 FBX 整合成單一多動作 GLB 時，不再產生多套文件或遺漏必要驗證。

任何盤點中看到的程式風險、文件矛盾或可改善處，只能記錄為 observation；不得在本任務內修改現有正確呈現。若未來真的觀察到產品問題，必須另開一份經使用者確認的修正計畫。

## 2. 任務輸出

建立唯一寵物規格：

```text
docs/pet-system.md
```

完成後，它是以下內容的唯一 owner：

1. 五個 FBX 的角色分工。
2. Blender 匯入、action-only 複製與骨架共用流程。
3. clip 命名、root motion 與座標軸規則。
4. 單一 GLB、共用 mesh/material/texture 的匯出規則。
5. Draco、WebP、縮圖與 mobile asset budget。
6. catalog metadata 與 runtime 呈現欄位的語意。
7. ground contact、模型 scale、陰影、marker 與 label 的驗證方法。
8. 新寵物的 automated、visual、Web 與 mobile checklist。
9. 發現文件衝突或資產異常時的停止條件。

`docs/game-assets.md` 最後只保留寵物資產總覽與一個 `docs/pet-system.md` 連結，不再重述整合規則。

## 3. 本任務允許與禁止的檔案

### 3.1 允許讀取

- `AGENTS.md`、`CSS_RULES.md`。
- Plan 16 與本文件。
- `docs/game-assets.md`、`docs/character-pet-3d-troubleshooting.md`。
- `docs/*multi-animation-glb.md`。
- `tools/export_*pet*.py`、`tools/export_*action*.py` 與實際被引用的 exporter。
- `src/features/world/` 的 pet animation、model、following 與 runtime 實作。
- `src/features/world/game-content-assets.ts`。
- pet 相關 tests 與 Supabase migration history。
- `public/assets/pets/` 的檔名、GLB metadata、hash、bytes 與 clip 資訊。

以上均以唯讀方式盤點，用來證明目前流程，不代表授權修改。

### 3.2 允許修改

- 新增 `docs/pet-system.md`。
- 更新 `docs/game-assets.md`，移除重複寵物流程並改成 canonical link。
- 將 `docs/character-pet-3d-troubleshooting.md` 改為只保留人物專屬內容，或把可共用寵物內容移入 canonical 文件。
- 在確認內容全部合併後，刪除 Jasmine、Moko、Nibus、Qifu-er 等個別 multi-animation 文件。
- 更新 `AGENTS.md`，只加入「修改／新增寵物前必讀 `docs/pet-system.md`」的指令。
- 更新必要的文件索引或 docs-only link test。

### 3.3 禁止修改

- `src/**/*.ts`、`src/**/*.tsx`、`src/**/*.css`。
- `tools/*.py` 與任何 exporter。
- `public/assets/pets/*`、原始 FBX、GLB、thumbnail。
- `supabase/migrations/*.sql`、seed、catalog row 或遠端 Supabase。
- pet tests 中的 runtime、asset bytes、動畫或 metadata assertion。
- scale、ground offset、walking offset、shadow、marker、label、speed、collision、follow distance 或 animation policy。
- dev server、部署、上架或第三方資源。

如果建立 canonical 文件時發現必須修改以上禁止範圍，立即停止並回報，不得擴張任務。

## 4. 事實來源優先順序

舊文件可能互相矛盾。canonical 文件只能依下列順序判斷目前正確流程：

1. 使用者已確認的產品決策：現有呈現正確，不改畫面與行為。
2. 實際 shipped GLB 與目前 runtime 行為。
3. 目前可重複 exporter 與 asset tests。
4. local asset registry 與最後有效 catalog metadata／migration result。
5. `docs/game-assets.md` 與個別整合文件。
6. 已過時 plan、舊 migration 註解或無法驗證的敘述。

衝突處理方式：

- 文件和現碼不同：記錄現碼，不改現碼。
- 舊 migration 註解和最後有效 metadata 不同：記錄最後有效結果，不改 migration history。
- exporter 與 shipped GLB 不同：標記「需要未來資產任務確認」，不重匯 GLB。
- 原始 FBX 不在 repository 或來源／授權不明：標記 unknown／provenance blocker，不猜測。
- 無法從證據判斷：在 canonical 文件寫明 unknown，請使用者決策；不得自行選一套說法。

## 5. Canonical 文件必須包含的五 FBX 流程

### 5.1 輸入檔角色

未來標準輸入為五個 FBX：

| 輸入 | 唯一用途 |
| --- | --- |
| Idle FBX | 唯一 base model：armature、skinned mesh、material、texture、Idle action |
| Walk FBX | 只提供 Walk action，不保留第二份 mesh/material/armature |
| Sit FBX | 只提供 Sit action |
| Wave FBX | 只提供 Wave action |
| Dance FBX | 只提供 Dance action |

若來源不是這五種、缺少 Idle base、骨架不相容或 action 數量不同，停止套用標準流程，先建立該資產的例外說明。

### 5.2 匯入前紀錄

canonical checklist 必須要求未來 AI 先記錄：

- catalog key、顯示名稱、來源與授權。
- 五個 source path、檔案 hash、bytes 與修改時間。
- 哪個 FBX 是唯一 base model。
- Blender 版本、exporter 路徑與執行命令。
- 預期 clips、模型大小、texture budget 與輸出路徑。
- 現有資產若為替換，記錄舊 GLB hash、bytes、clips 與可回退 commit。

原始 FBX 永遠唯讀，不覆寫、不重新命名、不把修正存回來源檔。

### 5.3 Base model 與 action-only import

- 清空 Blender 暫存場景，匯入 Idle FBX 作為唯一 base。
- 保留一份正式 armature、skinned mesh、material 與 texture。
- Walk、Sit、Wave、Dance 逐一匯入暫存 collection。
- 從暫存 armature 複製 action 到 base armature，確認 bone mapping 與 animation data 正確。
- action 複製完成後刪除暫存 mesh、armature、material、image 與 object，避免輸出五份模型。
- 驗證所有 action 都驅動 base skeleton；不能只看 Action Editor 有名稱就判定成功。
- skinned model clone 與 runtime mixer 的現有規則只做說明，本文件任務不修改 runtime。

### 5.4 Clip 命名與播放 contract

標準 clip 名稱固定為：

```text
Idle
Walk_InPlace
Sit
Wave
Dance
```

- 名稱大小寫與底線固定，不能為每隻寵物創造另一套 alias。
- Idle、Walk 的 loop 行為與 Sit／Wave／Dance 的 hold/repeat 行為要依目前 runtime contract 記錄。
- 每段 action 必須有有效 duration、keyframes 與 skeleton deformation。
- 不把五段動作拆成五個 GLB，避免重複 mesh、material 與 texture。

### 5.5 Root motion 與座標軸

- 世界水平移動由 steering 寫 actor root；`Walk_InPlace` 不得在最終 GLB 產生水平前進。
- 不能只檢查原始 FBX 或 Blender F-curve；必須檢查最終 GLB 的 root／Armature／Hips／Pelvis translation accessor。
- Blender 與 glTF 的 up axis／水平軸可能不同；文件要同時說明 Blender space 與最終 glTF space，不能籠統寫「鎖 XYZ」。
- 水平 root motion 與垂直 body motion 分開處理。只有目前 exporter／asset evidence 明確要求時才鎖垂直軸，不自行套用所有寵物。
- Sit、Wave、Dance 也檢查 root translation，避免互動開始或結束時 actor 瞬移。
- runtime defensive in-place clone 是第二層保護，不能取代 GLB asset audit。

### 5.6 匯出與最佳化

canonical 文件需從目前正確 exporter 整理實際參數，不發明新參數。至少說明：

- 單一 GLB、shared mesh across actions。
- Draco geometry compression。
- WebP texture 與目前 mobile texture size policy。
- 是否進行 mesh simplification、保留 UV seam／normal／tangent 的規則。
- animation export mode、sampling、keyframe optimization。
- 不重建或任意重新排列可能破壞 accessor 的 GLB JSON/BIN；若現有流程直接修改 binary accessor，要完整記錄限制。
- 輸出前清除暫存資料，確認只剩唯一正式模型與五個 actions。

### 5.7 最終 GLB automated validation

未來每次整合至少檢查：

- GLB header、可被 Three.js／現有 loader 解析。
- clips 恰好包含預期名稱，沒有重複、`.001` 或暫存 action。
- 只有一份預期模型／骨架／材質集合，五段 action 共用 mesh。
- Draco／WebP extension、texture、triangles、bytes 與 mobile budget。
- Walk root translation 的最終水平 range 符合 in-place tolerance。
- Sit／Wave／Dance 沒有非預期 actor displacement。
- skin、inverse bind matrices、bone mapping 與 animation target nodes 有效。
- exporter 可從相同 sources 重複產生可接受結果；hash 不同時必須解釋。

### 5.8 現有正確呈現的 runtime metadata 語意

canonical 文件要解釋欄位語意與驗證順序，但不得在本任務改值：

- `visualScaleMultiplier`：模型正規化後的視覺倍率。
- `groundOffset`：Idle／一般狀態的 world-space 高度修正。
- `walkingGroundOffset`：只有 Walk 啟用時的額外高度修正。
- `movementSpeedMultiplier`：steering speed 倍率，不是 clip root motion。
- `hideGroundShadow`：目前 runtime 中模型 cast/receive shadow 的既有語意。
- `hideGroundMarker`：runtime 自製 contact marker 的既有語意。
- `groundShadowScaleMultiplier`：contact marker 的既有比例語意。
- `nameLabelScaleMultiplier`、`nameLabelPlacement`：名稱尺寸與位置。
- collision/navigation 與 follow spacing 的目前 owner。

規則必須強調：未來改 `visualScaleMultiplier` 後要重新驗證腳底、名稱、marker 與 navigation；但本任務不重新驗證或改動現有值。

### 5.9 Ground、陰影與大小的未來驗收

新寵物／新 GLB 未來需要：

- 以 meadow base plane 判斷接觸，不以草葉尖端判斷。
- Idle 與完整 Walk loop 都檢查腳底／可見接觸點。
- 放大到最終 world scale 後再判斷，不在 source scale 下決定 offset。
- 區分 model light shadow 與 contact marker，不能用 marker 掩蓋浮空。
- 跟隨、巡遊、停止與互動使用一致的 ground、scale、shadow 與 label presentation。
- high/low quality、reduced motion、Web，以及準備 mobile release 時的 iOS／Android 真機驗收。

以上是未來新增／替換寵物的 gate，不是要求本任務重新調整現有寵物。

### 5.10 Catalog、測試與文件同步

未來新寵物完成 GLB 後，canonical checklist 應要求同步：

- `public/assets/pets/` model 與 thumbnail。
- local asset registry。
- 新的 Supabase catalog migration；不修改已發布 migration history。
- asset、clip、root-motion、metadata 與 runtime contract tests。
- `docs/pet-system.md` 的寵物 audit row。
- 需要發佈 iOS 時重新 build／`cap:sync`，不能假設 Web asset 自動進入舊 bundle。

遠端 migration、部署、上架仍需使用者另外明確批准；canonical 流程本身不授權外部操作。

## 6. 文件整併執行步驟

### Phase 0：確認工作區與範圍

- 讀完 Plan 16 的安全、Git 與回退章節，但不執行 Plan 16 的程式 extraction。
- 記錄 branch、HEAD、remote、working tree；已知總 checkpoint 為 `b24a93f`，開始時仍須重新確認。
- 記錄目前測試基線。Nibus `modelBytes` assertion 若仍失敗，只記為既有 test/metadata observation，不在本 docs-only 任務修 test、migration 或 GLB。
- 確認 diff 預期只包含第 3.2 節允許的文件。

### Phase 1：建立來源對照表

- 列出所有現有寵物文件、exporter、tests、asset 與相關 runtime owner。
- 對 Jasmine、Moko、Nibus、Qifu-er 等個別文件逐節標記：shared rule、pet-specific verified fact、duplicate、stale、unknown。
- 建立合併清單，確保每一段舊內容都有去向；此時不刪文件。

### Phase 2：撰寫 canonical 文件

- 依第 5 節結構建立 `docs/pet-system.md`。
- shared rule 只寫一次；個別寵物差異放同一份 audit table，不再建立新 pet-specific MD。
- 只寫有實際 code／asset／exporter／test 證據的目前事實。
- 不把 observation 寫成 bug，不提出現有 tuning 修改。

### Phase 3：逐來源核對

- 用對照表逐項確認舊文件內容已合併、標記 obsolete 或明確保留為 character-only。
- 檢查 canonical 文件內的 path、clip、metadata key、命令與 link。
- 如果兩份來源無法判定誰正確，保留 unknown 並回報使用者，不自行完成該段。

### Phase 4：切換唯一文件 owner

- 更新 `AGENTS.md` 與 `docs/game-assets.md`，只連到 canonical 文件。
- 將 troubleshooting 文件限制為 character-only，避免重新定義 pet contract。
- 確認內容完整後，最後才刪除個別 multi-animation 文件。
- 刪除舊文件前保存清單；若 reviewer 發現遺漏，可單獨 revert docs commit。

### Phase 5：文件驗證與交付

- `git diff --check`。
- 檢查所有 Markdown links 與 referenced local paths。
- `rg` 確認 repository 內沒有第二份文件重述五 FBX 流程、root-motion、ground／shadow tuning contract。
- 確認 diff 沒有 `src/`、`tools/`、`public/assets/`、`supabase/migrations/` 或 pet tests。
- 不因 docs-only 變更啟動 dev server；若執行現有 test suite，只記錄結果，不修既有非文件失敗。

## 7. Git 與回退

- 沿用 Plan 16 的 shared-history 規則。
- 建議一個 docs commit 完成 canonical 文件與 links；舊文件刪除可分成第二個 commit，便於發現遺漏時單獨 revert。
- commit 前明確 stage 文件，不使用 `git add .` 收入無關修改。
- 已 push 後若文件整併錯誤，使用 `git revert <docs-commit>`，不 reset／force push shared branch。
- 本任務沒有外部 mutation、DB、GLB 或 runtime 回退問題；若 diff 出現這些內容，代表任務已越界，應停止。

## 8. 下一個 AI 的檔案所有權

本任務只需要一位 docs owner。不要將 canonical 文件分給多位 AI 同時編輯，避免規則再次分叉。

允許另一位 reviewer 唯讀檢查：

- 五 FBX 流程是否完整。
- 舊文件是否有遺漏內容。
- path、clip、metadata key 與命令是否和現碼相符。
- 是否誤寫成要修改現有寵物。

reviewer 不直接修改 runtime／asset，也不在 review 中加入新的 tuning 建議。

## 9. 完成條件

- 建立一份完整的 `docs/pet-system.md`。
- 清楚記錄五 FBX → 單一五動作 GLB 的完整正確流程。
- 現有寵物呈現、runtime、GLB、exporter、metadata、migration 與 tests 均未修改。
- `docs/game-assets.md` 與 `AGENTS.md` 只連到 canonical 文件，不重述規格。
- 個別 multi-animation 文件的有效內容全部合併後移除，不再有多套流程。
- 無法驗證的來源／授權／流程差異明確標示 unknown，沒有猜測。
- Markdown links、local paths 與 `git diff --check` 通過。
- Git diff 只有經允許的文件。
- handoff 明確聲明：本任務只建立規則，沒有修正或重新驗證現有寵物呈現。

## 10. 下一個 AI 的交付模板

```md
## Scope
- Task: pet five-FBX canonical documentation only
- Baseline commit / branch:
- Runtime or asset changes authorized: no

## Source inventory
- Existing docs reviewed:
- Exporters/tests/runtime owners reviewed read-only:
- Unknown or conflicting evidence:

## Documentation changes
- Canonical document:
- Links updated:
- Old documents removed after merge:

## Verification
- Markdown links:
- Referenced paths:
- Duplicate-rule search:
- git diff --check:
- Diff outside allowed docs: none

## Behavior statement
- Existing pet presentation changed: no
- GLB/exporter/metadata/migration/tests changed: no
- External state changed: no

## Rollback
- Docs commit(s) to revert:

## Remaining items
- Unknown provenance or future decisions:
```

## 11. 禁止事項

- 不修、調整、最佳化或重新驗證為錯誤的現有寵物呈現。
- 不修改任何 scale、offset、shadow、marker、label、speed、collision、follow 或 animation 值。
- 不修改 runtime、component、CSS、exporter、GLB、thumbnail、migration 或 pet test。
- 不批次重匯現有寵物，也不為了讓文件一致而改程式。
- 不把文件矛盾自動解讀為產品 bug；只依實際正確結果建立說明。
- 不再建立任何寵物專屬整合流程 MD；差異全部進 canonical 文件的單一表格。
- 不自行啟動 dev server、apply remote migration、部署或上架。
- 不在 shared branch reset、force push 或重寫已公開歷史。
