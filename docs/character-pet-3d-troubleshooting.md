---
meta:
  contentType: Troubleshooting
  title: Debug character and pet grounding, walking, and flicker
  audience: AI coding agents and HabitHero maintainers
  goal: Diagnose and fix 3D character or pet presentation without hiding the root cause
---

# 如何修正角色與寵物的貼地、走路與閃爍問題

這份指南整理 HabitHero 3D 世界的實際除錯經驗。修改前先辨識模型、動畫、場景座標或渲染問題，再改唯一責任來源。不要先增加固定偏移、重複動畫迴圈或 CSS 覆蓋。

## 先找正確的責任來源

角色與寵物的世界呈現主要由以下檔案管理：

- `src/features/world/prototype-world-runtime.ts`: 模型載入、縮放、動畫、貼地、陰影與每幀更新
- `src/features/characters/world-character-catalog.ts`: 可選角色與模型 URL
- `src/features/world/pet-model-assets.ts`: 寵物模型解析
- `src/features/world/world-roaming.ts`: 巡遊方向、速度與停頓
- `src/features/world/pet-following.ts`: 跟隨距離與避障
- `terrain-prototype/procedural-grass-scene.js`: 草地平面、草葉高度與深度渲染
- `supabase/migrations/*.sql`: 寵物的 `groundOffset`、`visualScaleMultiplier` 與 `movementSpeedMultiplier`

不要用 CSS 修正 3D 模型高度。CSS 只控制 canvas 與介面版面，模型的 `x`、`y`、`z` 由 Three.js 場景管理。

## 角色浮在草上時怎麼查

「看起來浮空」可能來自不同根因。先固定角色、鏡頭角度與縮放，再依序檢查：

1. 確認 localhost 實際提供的新程式碼，不要只看工作區檔案
2. 確認場景狀態是 `ready`，並檢查 console error
3. 比較模型包圍盒最低點、腳部骨節點與可見鞋底
4. 確認動畫 mixer 更新後仍會重新貼地
5. 確認草葉會正常寫入 depth buffer，能遮住角色下半部

可用以下命令確認開發伺服器已載入新值：

```bash
curl -sS http://localhost:3000/src/features/world/prototype-world-runtime.ts \
  | rg "CHARACTER_GROUND_CONTACT_Y"
```

### 不要把整體包圍盒當成鞋底

`new THREE.Box3().setFromObject(model).min.y` 不一定是肉眼看到的最低點。蒙皮網格可能包含隱藏頂點、權重變形或匯出殘留幾何。

本次實測中，亞瑟模型的包圍盒最低點是 `0`，但腳趾骨最低點約為 `0.134`。用包圍盒貼地會讓鞋子停在高處，即使調整小幅 offset 也不明顯。

HabitHero 的 supplied characters 應優先使用名稱符合 `toe_end` 的骨節點。Three.js 會清理 glTF 節點名稱，例如 `mixamorig:LeftToe_End` 會變成 `mixamorigLeftToe_End`。用 `/toe_end$/i` 比對，不要依賴冒號。

目前腳部參考點的目標高度是 `CHARACTER_GROUND_CONTACT_Y = 0.055`。這個值代表腳趾骨的位置，不是鞋底或地面高度。只有確認腳部參考點正確後才能微調此值。

### 每幀更新動畫後再貼地

骨架動畫會改變腳部世界座標。正確順序是：

1. 更新 `AnimationMixer`
2. 更新模型 world matrix
3. 讀取左右腳部骨節點的 world `y`
4. 用較低的有效值計算角色 root 修正
5. 更新角色 root world matrix
6. 渲染場景

只在模型載入時貼地，走路動畫仍可能讓角色上下漂。每幀校正時要指定絕對目標，避免累積 offset。

### 寵物何時使用 metadata offset

寵物來源差異較大，未必都有一致的腳部骨架。現有 catalog metadata 支援：

- `groundOffset`: 調整寵物 root 的固定高度
- `visualScaleMultiplier`: 調整模型顯示大小
- `movementSpeedMultiplier`: 調整巡遊與跟隨速度
- `hideGroundShadow`: 隱藏不適合的圓形地面陰影

只在確認模型基準點無法統一後使用 `groundOffset`。同一隻寵物在跟隨與巡遊狀態必須共用同一個 offset。

## 走路時倒退、瞬移或循環跳動

這些症狀通常表示動畫 clip 含 root motion。場景 steering 已經移動 actor root，如果動畫也移動 `root`、`Hips` 或 `Pelvis`，角色會受到兩次位移。

使用 `createInPlaceAnimationClip()` 複製 clip，並固定以下 position track 的水平 `x` 與 `z`：

- `root`
- `mixamorig:Hips`
- `Hips`
- `Pelvis`

不要修改來源 clip。角色、巡遊角色與寵物必須使用同一套 in-place 正規化。

如果循環接縫仍跳動，檢查 clip 首尾姿勢、duration 與 root rotation。不要用每幀反向位移掩蓋不連續動畫。

## 停下時閃爍或短暫出現 T-pose

只有 `Walk_InPlace` 的模型沒有真正 idle clip。直接停止 action 會露出 bind pose，反覆 `reset()` 也會在走路姿勢與 T-pose 間閃爍。

HabitHero 的處理方式如下：

- 有 idle clip: 在 idle 與 walk action 間 cross-fade
- 只有 walk clip: 將 walk action 停在 clip 前段的穩定姿勢
- 暫停前: 先 `mixer.update(0)` 套用指定時間的骨架姿勢
- 再次走路: 從同一穩定時間恢復，不要先顯示 bind pose
- 同一 action 已啟用: 不要重複 `reset()`、`fadeIn()` 或建立新 action

`getWalkIdlePoseTime()` 目前使用 clip duration 的 `4%`，下限為 `0.033s`。若模型在此時間點姿勢不自然，先檢查 clip，再調整規則。

## 複製角色後動畫有跑但網格不動

`Object3D.clone(true)` 不會完整重映射 `SkinnedMesh.skeleton`。Mixer 可能正常前進，但可見網格仍停在 bind pose，或多個 actor 共用錯誤骨架。

所有蒙皮角色與寵物都使用 `SkeletonUtils.clone()`。建立 `AnimationMixer` 時，root 必須是複製後、實際加入場景的 model。

辨識訊號：

- mixer time 持續增加，但肢體不動
- 第一個 actor 正常，第二個 actor 變形或不動
- 移除來源模型後，clone 的動畫失效

## 角色走路時上下彈或浮動

不要同時疊加骨架步態、手寫 bob 與每幀貼地。三者會互相抵銷或放大。

目前巡遊角色不加垂直 bob。骨架動畫負責步態，貼地函式負責腳部接觸。可保留輕微 `rotation.z` 擺動，但 reduced motion 模式要停用。

若角色仍上下跳，記錄每幀腳部參考 `y`、actor root `y` 與 mixer time。固定鏡頭錄製一個完整循環，確認問題來自 clip 還是 grounding correction。

## 畫面閃爍、重影或模型時有時無

先用症狀區分原因：

- **整個場景重複閃動**: 檢查是否建立多個 `requestAnimationFrame` 或 runtime 未 dispose
- **切換面板後才閃動**: 檢查 React effect dependency 與 scene key 是否重建場景
- **角色姿勢閃動**: 檢查 action reset、cross-fade 與 walk-only idle fallback
- **表面斑駁閃爍**: 檢查重疊平面造成的 z-fighting
- **透明邊緣排序錯誤**: 檢查 `transparent`、`depthWrite`、`depthTest` 與 `renderOrder`
- **熱更新後貼圖錯誤**: 乾淨 reload 後重測，避免把已失效的 blob URL 當成產品問題

Runtime dispose 必須取消 animation frame、timer、事件監聽與未完成的 GLTF 載入。不要用強制 WebGL context loss 當一般清理流程。

## 陰影不能取代正確貼地

圓形 ground shadow 能提高接觸感，但不能修正模型高度。先讓腳部幾何正確，再調整陰影大小、透明度與位置。

陰影若離腳太遠，角色仍會像浮空。陰影若穿過透明模型或大型寵物，可透過 metadata 停用，但要保留真實 renderer shadow 或其他接觸線索。

## AI 修改流程

其他 AI 修改角色或寵物前，照以下順序執行：

1. 閱讀 `AGENTS.md`、`CSS_RULES.md` 與本文件
2. 用 `rg` 找到角色或寵物的唯一 owner
3. 固定孩子、模型、鏡頭、viewport 與動畫狀態
4. 記錄問題前截圖與 console 狀態
5. 量測 root、bounds、腳部骨節點與地面高度
6. 先寫會失敗的純函式或 runtime contract 測試
7. 修改座標或動畫根因，不增加無關 CSS
8. 用同一畫面重測 idle、walk、turn、follow 與 wander
9. 測試 reduced motion 與面板暫停後恢復
10. 執行完整驗證

完整驗證命令如下：

```bash
npm run lint
npm test
npm run build
npm run security:check
git diff --check
```

## 完成前檢查

- [ ] 角色鞋底位於草葉之間，沒有浮空或沉到腰部
- [ ] idle 與 walk 都維持貼地
- [ ] 動畫循環沒有倒退、瞬移或首尾跳動
- [ ] 停下時沒有 T-pose 或單幀閃爍
- [ ] 多個寵物不會共用錯誤 skeleton
- [ ] 跟隨與巡遊使用一致的 scale、ground offset 與速度規則
- [ ] 面板開關或 HMR 後沒有重複 runtime
- [ ] console 沒有新的 error 或 warning
- [ ] 診斷 log、臨時 data attribute 與測試資產已移除
- [ ] 完整驗證全部通過

## 可重用的除錯心得

### 可見接觸點比整體 bounds 更可靠

症狀是角色高度常數有變，但畫面沒有相應變化。根因通常是自動校正使用了錯誤參考點。下次遇到同類問題，先比較 bounds、腳部骨節點與可見鞋底，不先累加 offset。辨識訊號是包圍盒最低點與腳部骨節點相差超過模型高度的 `10%`。

### 動畫狀態要有單一 owner

症狀是角色停下、轉向或切換面板時閃爍。根因通常是多段程式同時 reset action、更新 mixer 或修改 model transform。下次遇到此訊號，列出每幀所有 transform 與 action writer，保留一個 owner，再刪除重複更新。

### 現場證據要能否定假設

症狀是測試通過，但使用者仍看不到修正。單元測試只能證明公式，不會證明公式使用了正確的模型參考點。下次先讓 runtime 暫時輸出 bounds 與腳部座標，用同一鏡頭驗證差值；確認後移除診斷輸出並保留純函式測試。
