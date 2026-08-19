# HabitHero 寵物資產 canonical 規格

> 狀態：現有寵物呈現已由產品確認為正確。本文件只定義下一次把同一隻寵物的五個 FBX 整合成單一多動作 GLB 的流程與驗收規則，不授權修改現有寵物。

## 1. 文件 owner 與不可逾越的邊界

這是寵物五個 FBX 整合流程的唯一文件 owner。`docs/game-assets.md` 只保留資產總覽與本文件連結；個別寵物不得再建立另一份整合流程。個別資產的來源、hash、bytes、clip 與 metadata 差異，放在本文件的 audit table 或當次變更證據中。

本規格的產品前提是：目前寵物的 Idle、Walk、Sit、Wave、Dance、跟隨、巡遊、停止、轉向、互動、大小、腳底接觸、陰影、marker 與名稱位置均視為 golden baseline。文件盤點發現的矛盾只能標記為 observation／unknown；不能因為文件與現況不同而修改 runtime、GLB、FBX、thumbnail、exporter、migration 或 catalog。

若未來真的觀察到畫面或行為問題，另開一份由使用者確認的修正計畫。那份修正計畫才可以授權 tuning、重新匯出或 runtime 變更。

### Canonical owner map

| 責任 | 唯一 owner | 本文件的角色 |
| --- | --- | --- |
| FBX → GLB 匯入、action 複製、root-motion 檢查 | 可重複的 `tools/export_*action*.py`（當次資產實際 owner） | 記錄流程與驗收 gate，不發明新參數 |
| 目前模型與縮圖路徑 | `src/features/world/game-content-assets.ts`、`src/features/world/pet-model-assets.ts`、`public/assets/pets/` | 唯讀核對；不得因文件整併改值 |
| 動畫播放與世界移動 | `src/features/world/pet-animation.ts`、`prototype-world-runtime.ts`、following／spawning owners | 記錄 contract，不改 runtime |
| catalog metadata | 最後有效 migration 的結果與目前 catalog row | 記錄欄位語意，不修改已發布 migration |
| 寵物整合規則 | `docs/pet-system.md` | 唯一文件 owner |

## 2. 標準輸入：五個 FBX

未來標準輸入必須是同一隻寵物的五個來源檔：

| 輸入 | 唯一用途 | 輸出中的結果 |
| --- | --- | --- |
| `Idle.fbx` | 唯一 base model、armature、skinned mesh、material、texture、Idle action | 保留一份正式模型與 `Idle` |
| `Walk.fbx` | 只提供 walk action | `Walk_InPlace` |
| `Sit.fbx` | 只提供 sit action | `Sit` |
| `Wave.fbx` | 只提供 wave action | `Wave` |
| `Dance.fbx` | 只提供 dance action | `Dance` |

檔名可以是中文或資產專屬名稱，但在輸入紀錄中必須明確標出五者角色。缺少 Idle base、來源不是五檔、骨架 hierarchy／bone mapping 不相容、某檔包含多個無法判斷的 action，或 action 數量與角色不符時，停止標準流程，建立例外說明並請使用者決策。

原始 FBX 永遠唯讀。不要覆寫、重新命名、移動來源檔，也不要把修正存回來源檔。

## 3. 匯入前的 evidence record

在開啟 Blender 或修改 scene 前，先建立可審查的輸入紀錄（可放在當次 PR／commit 描述或資產變更附件；不要把私人 Downloads 路徑猜成 repository 來源）：

- catalog key、顯示名稱、asset owner 與來源／授權狀態。
- 五個 source path、SHA-256、bytes、修改時間，以及哪個是唯一 base model。
- Blender 版本、實際 exporter 路徑與完整執行命令。
- 預期輸出 model／thumbnail path、五個 canonical clips、texture／mesh budget。
- 若替換既有資產，記錄舊 GLB hash、bytes、clips、extensions、catalog metadata snapshot 與可回退 commit。
- 是否存在現有同名 key、舊 GLB、舊縮圖、local registry、catalog row、migration 與 asset contract test。

來源、授權或 hash 無法取得時寫 `unknown`，不能用舊文件或檔名推測。這個 evidence gate 未完成前，不得匯出。

## 4. Blender action-only 整合流程

1. 用 Blender factory／空白 scene 開始，避免上一個資產的 object、action、image 或 material 混入。
2. 匯入 Idle FBX，確認只有一個正式 armature、skinned mesh、material／texture 集合與 Idle action。將 action 改名為 `Idle`。
3. 逐一匯入 Walk、Sit、Wave、Dance 到暫存 collection。每次確認來源帶入預期的 armature、mesh 與一個 action。
4. 只把 action 複製到 Idle 的正式 armature；確認 bone names、hierarchy、rest pose 與 action channel 能在 base skeleton 上變形。Action Editor 有名稱不代表骨架真的可播放。
5. 每次複製完成後立即移除該暫存 FBX 帶入的 armature、mesh、material、image 與 object；不要讓暫存資料進入輸出。
6. 將 action 固定命名為 `Idle`、`Walk_InPlace`、`Sit`、`Wave`、`Dance`，大小寫、底線與順序不可另創 alias。確認每段有有效 duration、keyframes 與可見 skeleton deformation。
7. 在匯出前逐段播放整個 clip；至少檢查 Idle、完整 Walk loop、Sit、Wave、Dance 的首尾姿勢、骨架變形、root／Hips／Pelvis translation 與是否意外帶入 actor 位移。

不要把五個 FBX 分別輸出成五個帶有重複模型的 GLB。目標是單一 GLB、單一正式 mesh／armature／material／texture 集合與五個 actions。

## 5. Clip、座標軸與 root motion contract

### 5.1 Canonical clip contract

輸出 animation names 必須恰好是：

```text
Idle
Walk_InPlace
Sit
Wave
Dance
```

`Idle`、`Walk_InPlace` 的 loop／停步行為，以及 Sit／Wave／Dance 的 hold／repeat 行為，沿用目前 runtime contract；不要在 asset 整合時創造另一套 state name。Runtime 以 `Idle`／`Walk_InPlace` 作為核心移動 action，Sit／Wave／Dance 是依 GLB 實際存在的 optional action。

### 5.2 Walk 的水平 root motion

世界 steering 負責 actor 的世界水平位置；`Walk_InPlace` 不得把前進位移留在 root／Armature／Hips／Pelvis 的水平軸。FBX、Blender 與 glTF 軸向不同，不能籠統寫「鎖 XYZ」：

- Blender FBX import 在目前 exporter 中以 X/Y 作水平面，`export_yup=True` 後 Blender Y 對應 glTF Z；因此必須以實際 exporter 與輸出座標確認水平軸。
- 匯出前，檢查 action f-curves 的 root／Hips／Pelvis translation；只將水平 channel 固定為第一幀值。不要未經證據把所有垂直 body motion 一起清掉。
- 匯出後，直接讀最終 GLB 的 JSON／BIN accessor，檢查 animation target node 的 translation track，而不是只看 Blender F-curve 或原始 FBX。
- 最終 glTF 水平 X/Z range 必須符合 in-place tolerance（目前資產測試使用 `0.0005`）；若超過，停止交付並查明 exporter、軸向或來源 action。
- 若 Blender 轉換仍在最終 GLB 產生 root 位移，只有在 exporter 的可重複腳本已有明確 binary patch／validator 時，才可在原有 JSON／BIN layout 上做 deterministic accessor 修正；禁止任意重建或重新排列 GLB chunk。

### 5.3 垂直 root／body motion

水平 actor movement 與垂直 body motion 分開處理。Walk 可能有合法的腳步／身體垂直動作；除非該資產的 exporter、runtime contract 與測試明確要求，不能套用「三軸全部歸零」。Sit／Wave／Dance 也要檢查 root translation，避免互動開始或結束時 actor 瞬移；發現垂直 track 的語意不明時標記 unknown，請使用者決策。

Runtime 的 `createInPlaceAnimationClip()` 是第二層防護，不能取代最終 GLB audit。不要用 runtime 每幀反向位移來掩蓋輸出資產的 root motion。

## 6. 單一 GLB 匯出與 mobile budget

### 6.1 已核對的 exporter 共通設定

目前可重複 action exporters 的共同證據包含：Blender 5.x、`export_format="GLB"`、`export_animations=True`、`export_animation_mode="ACTIONS"`、`export_optimize_animation_size=True`、`export_skins=True`、`export_apply=False`、`export_yup=True`、WebP image output、Draco geometry compression level 6，以及目前各腳本明確列出的 quantization settings。未來 AI 必須先找到並讀實際 exporter；不能從本文件複製一套新腳本或自行改 quality／quantization。

### 6.2 Mesh、texture 與縮圖

- 只保留 Idle base 的一份 mesh／armature／material／texture；所有 actions 共用它。
- 目前 action exporters 以 1024px 貼圖上限、WebP quality 約 82–84、Draco level 6 為既有 evidence；實際值以當次 exporter 與 asset test 為準。
- 若進行 mobile mesh simplification，必須記錄 ratio、輸入／輸出 triangles、modifier 順序與視覺驗證；只對唯一 base mesh 做，保留 skin weights、UV seam、material 分區、normal／tangent 所需資料。
- 透明縮圖通常為 512×512 RGBA PNG 或透明 WebP；依現有 local asset path 與 contract test，不任意換格式或底色。
- 輸出前清掉暫存 collection、armature、mesh、material、image、未使用 action 與其他 object；GLB 中不能出現五份模型或 `.001`／暫存 action。

### 6.3 不可任意後處理 GLB

部分現有 exporter 為避免 Three.js 相容性問題，會在既有 GLB binary chunk 內修正已驗證的 float accessor，而不重建 JSON／BIN。這是特定資產的 evidence，不是所有寵物的通用授權。任何後處理都必須保留 GLB header、chunk layout、accessor type／stride、skin、inverse bind matrices 與 animation target；若無法證明，停止並請 reviewer 檢查。

## 7. 最終 GLB automated validation

每一次未來五 FBX 整合都必須產出可審查的驗證結果。至少檢查：

- GLB magic／header 正確，可由現有 Three.js／GLTFLoader 解析。
- animation names 恰好為五個 canonical names；沒有重複、`.001`、暫存 action 或意外多餘 clip。
- 只有一份預期 mesh／skeleton／material／texture 集合，五段 action 共用 mesh；skin、inverse bind matrices 與 animation target nodes 有效。
- `KHR_draco_mesh_compression`、`EXT_texture_webp`（若由 exporter 輸出）存在且可解析；texture 尺寸、triangles、bytes 符合當次 mobile budget。
- `Walk_InPlace` 的每個 root／Armature／Hips／Pelvis translation track：glTF 水平 X/Z range 在 tolerance 內；垂直 range 若存在，必須有明確 asset contract 說明。
- Sit／Wave／Dance 的 root translation 不會使 actor 在 action 開始／結束時非預期位移。
- 來源檔、輸出 GLB、縮圖、catalog key／model path、local registry 與測試的對應關係一致。
- 同一 exporter 從相同 sources 可重複產生可接受結果；hash 不同時記錄 Blender／exporter／來源差異，不以「檔案能載入」當作充分證明。

建議使用既有資產 test 與 exporter 的檢查邏輯；本 docs-only 任務不新增或修改 tests。至少執行該資產已有的 test、`npm run lint`、`npm run build` 與 `git diff --check`，但任何既有非文件失敗只能回報，不能為了讓本任務全綠而改 runtime／asset／migration。

## 8. Runtime metadata 語意與現有呈現 baseline

以下是目前 runtime 讀取的欄位語意。它們是說明與未來驗收欄位，不是本任務要調整的數值：

| 欄位 | 語意與 owner | 未來驗收重點 |
| --- | --- | --- |
| `visualScaleMultiplier` | normalized model 後的視覺倍率；runtime 先以寵物高度／尺寸正規化，再乘此倍率 | 放大後重新看腳底、名稱、marker、shadow 與 navigation；不要直接改 GLB skeleton／mesh scale |
| `groundOffset` | Idle／一般狀態的 world-space root 高度修正 | 以 meadow base plane 與最終 world scale 判斷，不以草葉尖端判斷 |
| `walkingGroundOffset` | 只有 Walk action active 時的額外高度修正 | 只在 evidence 顯示 walk clip 的腳底高度不同時使用；跟隨與巡遊共用同一語意 |
| `movementSpeedMultiplier` | steering／巡遊／跟隨速度倍率，不是 clip root motion | 不用速度倍率掩蓋 root motion 或 clip timing 問題 |
| `hideGroundShadow` | 隱藏模型真正 cast／receive 的 renderer shadow | 不要把它當作關閉 runtime marker |
| `hideGroundMarker` | 隱藏 runtime 額外建立的橢圓 contact marker | marker 不能掩蓋浮空；保留或關閉須有目前產品 evidence |
| `groundShadowScaleMultiplier` | runtime contact marker 的比例（若 marker 啟用） | 區分 marker 與太陽／模型陰影，不能用 marker 修貼地 |
| `nameLabelScaleMultiplier` | 寵物名稱的 world-size multiplier；runtime 會依 model scale 反比換算 local scale | 放大模型後名稱仍維持預期世界尺寸與 above-head gap |
| `nameLabelPlacement` | 目前 catalog／runtime 使用的名稱位置語意，例如 `above-head` | 檢查 Idle、Walk、follow、wander、interaction 與不同 quality |
| `collisionRadius`／navigation owner | catalog 的碰撞半徑與 runtime 的 navigation／follow spacing 計算 | 不因視覺倍率自行猜碰撞；確認跟隨、巡遊與裝飾避障一致 |

Runtime 現有行為包括 `SkeletonUtils.clone()`、共享 model source cache、`AnimationMixer`、steering 負責世界位置、Walk in-place defensive clone，以及必要時的 walk-only stop pose。這些是目前正確呈現的 implementation facts；未來資產整合不能把它們改成另一套規則。

## 9. Ground、大小、陰影與名稱的 future acceptance

這一節是新寵物／新 GLB 的驗收 gate，不是要求重新調整現有寵物：

1. 使用 meadow base plane 判斷接觸，不以草葉尖端或整體 bounds 的最低點直接判斷。
2. 在最終 world scale 下檢查 Idle 與完整 Walk loop 的腳底／可見接觸點；若模型有可靠 toe／foot bones，優先記錄它們的 world Y。
3. 區分模型真正的 renderer shadow 與 runtime contact marker。陰影可以增加接觸感，但不能修正模型高度；不能用 marker 掩蓋浮空。
4. 在 follow、wander、stop、turn、Sit、Wave、Dance 以及模型展示預覽中，確認 ground、scale、shadow、marker、label 使用同一份 catalog/runtime 語意。
5. high／low quality、reduced motion、Web，以及準備 mobile release 時的 iOS／Android 真機，至少各完成一個固定場景檢查。
6. 若改 `visualScaleMultiplier`、`groundOffset` 或 shadow／label metadata，必須保存 before／after 截圖、狀態紀錄與精確 rollback；本文件任務不改這些值。

## 10. Catalog、local registry、測試與 release 同步

未來 asset 真的要加入／替換時，才按以下順序同步；這不是本次 docs-only 任務要執行的外部操作：

1. 輸出 `public/assets/pets/<stem>.glb` 與透明 thumbnail，保存 hash／bytes／clips／extensions。
2. 更新 `src/features/world/game-content-assets.ts` 與必要的 pet model resolution owner，維持一個 canonical asset key/path。
3. 建立新的 Supabase migration（使用 `npx supabase migration new ...`）；不可修改已發布 migration history。metadata 至少記錄 source、model、thumbnail、`animation`、`idleAnimation`、`animationClips`、`animationStates`、`rootMotion`、`meshSharedAcrossActions`、compression 與已驗證的尺寸／budget facts。
4. 新增／更新該 asset 的 contract tests，涵蓋 clips、shared mesh、GLB extensions、root-motion tolerance、bytes／texture budget、catalog path 與 metadata。不要用複製舊 bytes 的 assertion 冒充新輸出證據。
5. 更新本文件的 audit row、source evidence、migration／test links；不再建立新的 `<pet>-multi-animation-glb.md`。
6. 若要進 iOS，先使用當時有效的 publishable key 並執行 `npm run cap:sync`；不能假設 Web asset 會自動進入舊 bundle。
7. 遠端 migration、部署、真機驗證、上架與第三方資源變更都要另外取得使用者明確批准。

## 11. 既有資產 audit（唯讀 baseline，不是修正清單）

下表整合已讀取的舊 multi-animation 文件、exporter、tests、GLB／catalog 相關證據。它只保存現況與來源，不能被解讀為本次要重新匯出的工作。`unknown` 必須在未來真的替換該資產前由證據補齊。

| Asset key | 已知來源／輸出 | 已知 clips／流程證據 | 當次注意事項 |
| --- | --- | --- | --- |
| `pet.jasmine` | `public/assets/pets/jasmine.glb`；base `茉莉Idle.fbx`；其餘四檔為 walk／sit／wave／dance；約 785,508 bytes；migration `20260818080000_add_jasmine_and_christo_actions.sql` | 五個 canonical clips；shared mesh；Draco／1024px WebP；exporter `tools/export_jasmine_christo_action_assets.py`；walk 水平 root normalized | 現有 metadata／呈現值是 baseline，不在此重調；PNG thumbnail 為 512 RGBA |
| `pet.moko` | `public/assets/pets/moko.glb`；base `莫可Idle.fbx`；`莫可.fbx`、坐下、揮手、跳舞；1,457,608 bytes／72,821 triangles；migration `20260818103000_replace_moko_with_five_actions.sql` | 五個 canonical clips；shared mesh／texture；`tools/export_moko_action_assets.py`；Draco level 6、1024px WebP、ratio 0.20；Walk 匯出前 normalized | source path 有 Downloads／`habithero動作檔` 混用；未來整合先重新取得 hash／授權 evidence |
| `pet.nibus` | `public/assets/pets/nibus.glb`；base `尼布斯Sad Idle.fbx`；Walk／Sit／Wave／Dance source；migration／exporter 均存在 | 五個 canonical clips；`tools/export_nibus_action_assets.py` 在 export 前後檢查 root track；最終 GLB 三軸 patch／validator 的 tolerance 為 0.0005；Draco／WebP | 舊紀錄曾出現 `modelBytes` mismatch observation；目前 baseline test 已通過，未來替換前仍須重新量測 bytes／hash。Plan 17 不修 test、migration 或 GLB |
| `pet.qifu-er` | `public/assets/pets/qifu-er.glb`；base `齊福爾Idle.fbx`；其餘四檔；migration `20260818110326_replace_ailite_with_qifu_er.sql` | 五個 canonical clips；`tools/export_qifu_er_action_assets.py`；1024px WebP、quality 82、ratio 0.12；Walk 最終 accessor X/Y/Z ≤ 0.0005；Draco／WebP | 這是從艾莉特 active shop row 替換而來；不要把 retired `pet.ailite` 當成新 key |
| `pet.christo` | `public/assets/pets/christo.glb`；現有 Idle／Walk 加上 Sit／Wave／Dance source；migration 與 Jasmine exporter | 五個 canonical clips；shared mesh；Walk horizontal in-place test；約 1.28 MB 的舊記錄 | available docs 沒有獨立五檔 base evidence 的完整紀錄；標記為 future provenance unknown，不自行補猜 |
| `pet.ailite`（retired／保留 inventory） | `public/assets/pets/ailite.glb`；base `艾莉特idle.fbx` 加四個 action FBX；exporter `tools/export_ailite_action_assets.py`；migration `20260818103706_add_ailite_pet.sql` | 五個 canonical clips；1024px WebP、quality 82、ratio 0.12；後續被 Qifu-er 取代 | 只作既有 inventory 的歷史參考；不得重新啟用、重匯或改 presentation |
| `pet.oum`、`pet.arcadia` | 現有 exporter／GLB 具五個 action，但 `tools/export_oum_action_assets.py`／`export_arcadia_action_assets.py` 明確保留 authored Walk vertical motion | 與新標準的水平 in-place／垂直 body motion 分離規則有歷史差異 | legacy observation，不可複製成新寵物標準；若未來替換需另做 root-motion contract 決策 |

其他只含 Idle／Walk 或非五 FBX 來源的寵物，不得假設能直接套用本流程；先補齊五個來源、骨架與授權 evidence。

## 12. 停止條件與交付 checklist

遇到以下任一情況立即停止，不要為了讓流程完成而猜測或修改現況：

- source／license／hash／base model 身份不明。
- 五個 FBX 不是同一骨架，或 action 不能在 Idle skeleton 正確變形。
- GLB 出現重複 mesh、material、texture、暫存 action 或意外 clip。
- Walk 最終 GLB 仍有超出 tolerance 的水平 root motion，或 Sit／Wave／Dance 造成 actor displacement。
- exporter、GLB、catalog metadata、local registry、tests、舊文件互相矛盾且無法依 evidence priority 判定。
- 需要修改 `src/`、`tools/`、`public/assets/`、`supabase/migrations/`、tests 或遠端狀態才能「對齊文件」。

交付前逐項確認：

- [ ] 五個 source path／hash／bytes／license status 已記錄。
- [ ] 唯一 Idle base 與四個 action-only imports 可追溯。
- [ ] canonical clip names 恰好為五個，且每個能在 base skeleton 播放。
- [ ] 單一 GLB 共用 mesh／armature／material／texture，無 duplicate／`.001`。
- [ ] Walk 最終 glTF root horizontal range 通過 tolerance；垂直 track 語意已記錄。
- [ ] Draco／WebP／thumbnail／mobile budget 與 exporter evidence 一致。
- [ ] GLB parser、asset contract tests、lint／build 的結果已回報。
- [ ] runtime metadata 只同步已驗證 facts；ground／scale／shadow／label 有固定場景 before／after evidence。
- [ ] `game-content-assets.ts`、catalog migration、tests、GLB、thumbnail 與 canonical key/path 一致。
- [ ] 修改已發布 asset 時有獨立 commit、精確 revert；沒有 shared branch reset／force push。

本文件本身不會要求現有寵物重新驗證或重新匯出。完成文件整併後，應明確回報：「現有寵物呈現、runtime、GLB、exporter、metadata、migration、tests 與外部狀態均未改變。」
