# HabitHero 寵物資產、動作、貼地與陰影單一規格整合計畫

## 1. 任務目的

建立一條可驗證的寵物整合流程，統一回答以下問題：

- 原始 Walk 是否帶前進／垂直 root motion，最終 GLB 是否為原地走路。
- 世界 steering、動畫與 actor transform 各由誰寫位置。
- 模型放大後，腳或可見接觸點是否仍落在草地基底。
- 真實燈光陰影與 runtime 橢圓 contact marker 是否正確區分。
- 跟隨、巡遊、待機與互動動作是否共用相同的模型、貼地與呈現設定。
- 所有規則最後只由一份 canonical 文件說明，不再維護多套寵物 MD。

本計畫是 Plan 16 的 3D runtime 子任務。先完成必要的 runtime extraction 或至少鎖定 facade，避免繼續把寵物邏輯加入 `prototype-world-runtime.ts`。

## 2. 已確認的目前實作

| 項目 | 現況 | 風險／矛盾 |
| --- | --- | --- |
| 實際移動 | `pet-following.ts`、`world-roaming.ts` 計算 x/z；frame loop 寫 actor root | 這是正確 owner，但仍嵌在 2,834 行 runtime 的每幀流程 |
| root motion | 多個 Blender exporter 會修正；runtime `createInPlaceAnimationClip()` 再固定 root/hips/pelvis 的 x/z | 匯出腳本有的鎖 x/z、有的鎖 x/y/z；沒有一份全資產報告 |
| Nibus | 專屬文件說原始 FBX 無位移且最終 XYZ range ≤ 0.0005；exporter 會做兩階段 normalize | migration 頂端仍寫保留 authored root motion，metadata 又寫 `in-place`；文字互相衝突 |
| 動畫 | `pet-animation.ts` 選 Idle/Walk/Sit/Wave/Dance；runtime 管 mixer、crossfade、停步 pose 與互動 action | state machine 分散在 pure helper、runtime 與 UI action menu |
| 基準正規化 | `defineAsset()` 以靜態 Box3 將 source bounds min.y 對到 model root 0 | skinned animation 的腳底未必等於靜態 bounds；目前寵物沒有逐幀腳部 grounding |
| 貼地 | catalog metadata `groundOffset` 加到 actor root；Walk 可再加 `walkingGroundOffset` | offset 是世界單位，放大後不自動重算；靠人工 migration 試值 |
| 模型大小 | `getPetModelScale()` 依人物高度與模型最大尺寸正規化，再乘 `visualScaleMultiplier` | `updatePetActorState()` 算出 visual multiplier 卻未套用既有 actor；live metadata 更新不一定改變畫面 |
| 導航大小 | `getPetNavigationRadius(collisionRadius, entityScale)` | 跟隨 actor 使用 catalog `maxScale`，巡遊 actor 使用 entity scale；都未直接使用最後 rendered footprint／visual multiplier |
| 陰影 | `hideGroundShadow` 會關閉 mesh cast/receive shadow；`hideGroundMarker` 控制自製圓形 marker | 名稱容易誤解，歷史 migration 曾混用；marker 是 scaled root 的 child，模型倍率會影響它 |
| actor 更新 | `TerrainWorldLayer` scene key 排除 pet/decorations，mounted runtime 做 in-place update | `docs/game-assets.md` 仍宣稱 metadata 會納入 scene signature 並重建，與現碼不符 |
| 文件 | `game-assets.md`、`character-pet-3d-troubleshooting.md`、Jasmine/Moko/Nibus/Qifu-er 專屬文件 | 數值、migration 名稱、root-motion 說法與 runtime 已漂移 |
| 測試基線 | 681 項中 680 通過 | Nibus test 期待 `modelBytes=1327240`，migration 為 `1324816`；測試與資產 metadata 不一致 |

結論：現在已經有許多正確的局部修補，但「資產輸出、資料 metadata、runtime 呈現、文件與測試」還沒有同一條 contract。

## 3. 單一真相來源決策

### 3.1 文件只保留一份

建立 `docs/pet-system.md` 作為唯一寵物規格，內容包含：

1. 名詞與 owner map。
2. 原始 FBX → action-only import → GLB → catalog migration → runtime 的流程。
3. 動畫 clip、root-motion 與 axis 規則。
4. scale、ground contact、shadow、marker、label、navigation footprint 的單位與計算順序。
5. 跟隨／巡遊／待機／互動 state machine。
6. 每隻現役與需相容的歷史寵物 audit matrix。
7. 新增／重匯寵物 checklist、命令與驗收閘門。
8. 常見故障與診斷流程。

整併完成後：

- 從 `docs/game-assets.md` 移除寵物細節，只留資產總覽與一個 `pet-system.md` 連結。
- 將 `docs/character-pet-3d-troubleshooting.md` 的寵物內容合併進 canonical 文件；人物專屬內容若仍需要，改成只談 character，不能再定義 pet 規格。
- 合併並刪除 `jasmine-`、`moko-`、`nibus-`、`qifu-er-multi-animation-glb.md`；資產差異放 canonical matrix，不保留第二套流程。
- `AGENTS.md` 只加入「修改寵物前必讀 `docs/pet-system.md`」，不複製內容。

### 3.2 執行設定不新增第二套手寫數值

目前 runtime tuning 以 Supabase catalog metadata 為資料來源。第一階段維持這個 owner，先建立 typed parser 與有效值 audit，不另建一份需要手動同步的 hard-coded pet config。

- 新增 `pet-presentation-config.ts`：只定義 schema、defaults、legacy key compatibility 與 validation，不逐隻硬編碼數值。
- 新增 audit script 從 migration／本機 Supabase 或明確輸入的 catalog snapshot 產生報告；報告可生成 canonical matrix，但不得成為另一份 runtime config。
- 若未來要讓 local manifest 成為 owner，必須同時提供 migration 產生器，禁止人工維護 manifest 與 SQL 兩套值。這是獨立決策，不在本輪偷偷切換。

## 4. 目標模組

建議在 `src/features/world/pets/` 集中：

| 模組 | 唯一責任 |
| --- | --- |
| `pet-presentation-config.ts` | typed metadata schema、單位、defaults、legacy adapter、validation errors |
| `pet-asset-definition.ts` | model URL、clip capability、source/provenance view；沿用 local asset registry，不複製 URL |
| `pet-animation-clips.ts` | clip 選擇、in-place clone、root-motion policy、action playback |
| `pet-model-factory.ts` | SkeletonUtils clone、normalization、material、mixer、label、shadow/marker objects |
| `pet-grounding.ts` | ground anchor、idle/walk offset、presentation metrics 與純函式測試 |
| `pet-actor-controller.ts` | actor type、create/update/dispose、mutable vs structural presentation change |
| `pet-frame-controller.ts` | follow/wander/action state 與每幀更新順序；使用既有 pure steering 模組 |
| `pet-following.ts`、`pet-spawning.ts` | 保留純導航邏輯，移入資料夾或由相容入口 re-export |

`prototype-world-runtime.ts` 只建立 pet controller、傳入 obstacles/player snapshot，並在 frame loop 呼叫 `update(delta)`；不得再知道每個 metadata key。

## 5. 明確技術 contract

### 5.1 座標與 root motion

- 世界 x/z 只能由 steering 寫入 actor root；animation clip 不得產生世界水平位移。
- `Walk_InPlace` 必須在最終 GLB 檢查 root／Armature／Hips／Pelvis 的世界水平位移 range，而不是只看 Blender F-curve 或 track 名稱。
- 垂直 motion 與水平 motion 分開定義：每個資產記錄 `verticalRootMotionPolicy = preserve | lock`。不能因 Blender/glTF 軸轉換而籠統鎖「XYZ」卻沒有說明。
- runtime 保留 defensive in-place clone，但 asset audit 仍必須通過；runtime fallback 不能掩蓋壞資產。
- 互動 Sit/Wave/Dance 也檢查 root translation，避免執行後 actor 瞬移。

### 5.2 Scale 與 ground contact

計算順序固定為：source bounds/anchor → normalization scale → entity/default scale → visual multiplier → world presentation metrics → state ground offset。

- 草地接觸面明確定義為 meadow base plane `y=0`，不是草葉尖端。
- `groundOffset` 與 `walkingGroundOffset` 標示為 world units；改 `visualScaleMultiplier` 後必須重新跑 contact audit。
- offline audit 以最終 GLB 取樣 Idle 與完整 Walk loop；優先使用明確 foot/toe bones，找不到時使用可見 skinned mesh 接觸點，不用整體靜態 Box3 直接當腳底。
- audit 至少輸出：source size、final modelScale、idle lowest contact、walk min/max contact、建議 offset、是否穿地、是否浮空。
- runtime 不做昂貴的每幀全 mesh Box3；使用 audit 得到的 anchor/offset。若需要 per-frame correction，必須先有效能證據與 low-quality fallback。
- 驗收建議：Idle 接觸點距 base plane不超過 0.02 world unit；Walk 全循環不得可見浮空超過 0.03，也不得持續穿地超過 0.03。特殊飛行寵物需在 matrix 明列例外與視覺接觸方式。

### 5.3 視覺大小與導航 footprint

- 建立 `getPetPresentationMetrics()`，一次回傳 modelScale、rendered footprint、navigation radius、label local scale、marker scale 與 ground offsets。
- 跟隨與巡遊使用同一組 presentation metrics；不再一邊用 catalog `maxScale`、另一邊用 entity scale。
- 決策閘門：建議所有寵物保存／使用明確 `defaultWorldScale`，following 沒有 entity transform 時用 default，不得把 `maxScale` 當預設值。若產品選擇另一方案，先更新 canonical 文件與 tests。
- navigation radius 由 catalog collision base 與實際 world scale 的明確公式產生；需測大型寵物不互穿、也不因視覺倍率造成過大空白距離。

### 5.4 陰影與 marker

canonical 文件統一用以下語意：

- `modelShadow`: renderer light 產生的 cast/receive shadow。
- `contactMarker`: runtime 建立的半透明橢圓／圓形接觸提示。

typed adapter 可暫時讀取 `hideGroundShadow`／`hideGroundMarker`，但新 API 與測試不再混用名稱。需要改資料欄位時用向後相容 migration，不能直接讓舊 catalog 失效。

- marker 尺寸由 world footprint 計算，避免又被 root scale 重複放大。
- marker y 固定相對 meadow plane，不跟著負 ground offset 沉入地下。
- `hide model shadow` 不應順便改模型材質或 marker；兩個開關各自測試。
- low-quality renderer 關閉 shadows 時，若 marker 是唯一接觸線索，必須有明確 fallback 行為。

### 5.5 Mutable update 與 rebuild

- metadata 更新分為 mutable（速度、名稱可見、簡單 offset）與 structural（model URL、clip set、model scale、shadow/marker object topology）。
- structural signature 改變時只替換該 pet actor，保留世界 scene、位置、follow index、action state 與 model cache；不重建整個 terrain。
- 移除 `updatePetActorState()` 中計算後未使用的 `visualMultiplier`，並以測試證明 scale metadata 更新會實際改變 actor。
- 文件不得再宣稱 pet metadata 位於 terrain scene remount key，除非程式真的如此。

## 6. 執行階段

### Phase 0：修正基線與建立全資產 audit

- 先修 Nibus `modelBytes` test／migration／實際檔案三者不一致；不得只放寬成「任意數字」。
- 列出 `public/assets/pets/` 的現役與歷史相容資產、catalog key、source FBX、exporter、clips、bytes、triangles、root motion、scale、offset、shadow、marker、label、speed 與 license/provenance。
- 對所有 GLB 執行統一的 binary/accessor audit；不可只驗證 Nibus、Qifu-er 等已有專屬測試的資產。
- 缺原始 FBX 或授權資訊時標為 release blocker/known risk，不猜來源。

### Phase 1：先寫 contract tests 與 typed config

- 為 metadata parser 寫 table-driven tests：缺值、NaN、負 scale、legacy keys、unknown fields。
- 為 root motion、contact metrics、scale/navigation、shadow/marker 與 structural signature 寫 pure tests。
- 將現有以 migration regex 驗證數字的測試，改成解析有效 catalog metadata 或 audit output；source regex 只保留安全必要條件。

### Phase 2：抽離模型、動畫與 grounding

- 從 `prototype-world-runtime.ts` 移出第 4 節模組，保持公開 facade 相容。
- 統一 `createInPlaceAnimationClip()` 與 exporter 驗證規則；先產生報告，再決定哪些 exporter 只鎖水平、哪些明確鎖垂直。
- 實作 presentation metrics，讓 root、marker、label、navigation 使用同一個 final scale。

### Phase 3：統一 actor state 與 live update

- 將 idle/walk/action crossfade 與 follow/wander steering 組成可測 controller。
- 驗證同一 pet 從 idle → wander → follow → interaction → idle 不改變 scale、ground anchor、shadow 或 marker。
- structural metadata 更新只重建 actor；非 structural 更新原地 patch。
- 保留目前多寵物 follow trail snapshot 修正，不得在重構時退回同幀 leader mutation。

### Phase 4：逐隻視覺驗收與 tuning migration

- 先跑 audit，再產生必要 tuning migration；不憑單張截圖手調。
- 每隻寵物檢查 Idle、完整 Walk 循環、轉向、停止、跟隨、巡遊、Sit/Wave/Dance（若有）、high/low quality。
- 視覺驗收使用固定 camera、相同 meadow plane 與 scale 標尺；保存小型報告／數值，不把大量影片或暫存 render commit 進 repository。
- 若需連遠端 Supabase 驗證，依 `AGENTS.md` 外部動作邊界先取得使用者核准；本 plan 不授權部署 migration。

### Phase 5：整併單一文件

- 以已通過的 audit output 填寫 `docs/pet-system.md`，再刪除重複文件。
- 用 test 檢查 canonical 文件存在、舊 pet-specific 文件不存在、`AGENTS.md` 與 `game-assets.md` 只指向 canonical 文件。
- 文件中的 current matrix 必須標示生成／驗證日期與對應 catalog snapshot，不寫無法驗證的「目前」數值。

## 7. AI 任務切分

| 任務 | 擁有範圍 | 不得同時修改 |
| --- | --- | --- |
| P1 Asset auditor | audit script、GLB contract tests、read-only report | runtime 行為、SQL deployment |
| P2 Config/metrics | typed config、grounding、presentation metrics | UI、asset binaries |
| P3 Model/animation | model factory、clip policy、mixer tests | follow algorithm、SQL tuning |
| P4 Actor controller | actor lifecycle、follow/wander/action integration | exporter、docs consolidation |
| P5 Catalog reconciliation | 新 migration、catalog snapshot tests | remote apply，除非使用者另行核准 |
| P6 Visual QA | 固定場景驗收與 issue matrix | 直接改值；問題先回交 P2/P5 |
| P7 Docs | canonical 文件、舊文件移除、links | 未經 audit 的新規格 |

每位 AI 完成時回報：修改檔案、重構前後行數、audit/test 命令、逐項結果、未驗證資產、是否需要外部核准。

## 8. 驗收矩陣

每隻現役或需相容的歷史寵物都必須有一列，至少包含：

| 欄位 | 必填內容 |
| --- | --- |
| Identity | catalog key、display name、active/legacy |
| Source | base FBX、Walk/action FBX、license/provenance、exporter |
| GLB | URL、bytes、triangles、compression、clips、shared mesh |
| Motion | source horizontal/vertical range、final GLB range、runtime policy |
| Presentation | normalization scale、default/entity scale、visual multiplier、final footprint |
| Ground | anchor method、idle offset、walk offset、sampled min/max contact |
| Shadow | modelShadow、contactMarker、marker scale、low-quality behavior |
| Navigation | collision base、final radius、follow spacing result |
| Runtime | idle/wander/follow/actions、mutable/structural update result |
| Evidence | automated tests、visual QA date、known exception |

## 9. 完成條件

- 所有 shipped pet GLB 都有自動 root-motion 與 clip audit；水平 movement owner 只有 steering。
- 每隻寵物在最終 world scale 下通過 Idle/Walk contact tolerance，或有明確的飛行例外。
- 跟隨與巡遊共用同一 presentation metrics；尺寸、navigation、shadow、marker、label 不再各算一套。
- catalog metadata 更新可預期地 patch 或重建單一 actor，文件與程式一致。
- `prototype-world-runtime.ts` 不再包含 pet metadata parser、model factory、animation state machine 與 actor collection 細節。
- repository 只剩一份 `docs/pet-system.md` 定義寵物規格；其他文件只允許單一連結，不重述規則。
- `npm run lint`、`npm test`、`npm run build`、`npm run security:check`、asset audit、`git diff --check` 全通過。

## 10. 禁止事項

- 不以加大橢圓 marker 掩蓋浮空；先修 ground contact。
- 不只看靜態 Box3 或草尖判斷腳底。
- 不在 runtime、migration、文件與 test 各寫一份寵物數值。
- 不把 catalog `maxScale` 當 following 預設尺寸，除非產品決策明確如此。
- 不因某一隻寵物例外，在核心 runtime 繼續加入 `if (assetKey === ...)`；例外要進 typed catalog metadata 與 audit matrix。
- 不直接修改原始 FBX；輸出 GLB 與可重複 exporter 分開管理。
- 不在沒有使用者核准時 apply 遠端 migration、部署或覆寫第三方資源。
