---
title: Debug supplied character grounding, walking, and flicker
goal: Diagnose character presentation without hiding the root cause
---

# 角色 3D 貼地、走路與閃爍除錯

本文件只處理 supplied character 的除錯。寵物的五個 FBX → 單一 GLB 流程、metadata 語意與 future acceptance 由 [`pet-system.md`](./pet-system.md) 唯一維護；不要在本文件新增寵物專屬整合規則。

## 先找正確的責任來源

角色的世界呈現主要由以下 owner 管理：

- `src/features/world/prototype-world-runtime.ts`：GLTF 載入、模型正規化、AnimationMixer、root transform、貼地與 dispose。
- `src/features/world/TerrainWorldLayer.tsx`：場景生命週期、quality／reduced-motion 與 UI 到世界的接線。
- `src/features/world/game-content-assets.ts`：character model／thumbnail manifest。
- `src/features/world/character-*.ts`：角色專屬模型或動畫 helper（先用 `rg` 找實際檔名）。
- `public/assets/characters/`：已交付 GLB 與縮圖；來源檔不在 runtime 目錄。

先用 `rg` 找唯一 owner，確認問題是在來源 GLB、animation clip、runtime transform、scene lifecycle，還是 CSS／UI。不要直接追加 CSS 或在每幀加補償值。

## 角色浮在草上時怎麼查

### 先固定可重現場景

固定角色 key、模型、鏡頭、viewport、quality、reduced-motion、animation state 與地形 seed。保存問題前截圖、console、GLB hash 與瀏覽器／裝置資訊；同一畫面同時測 idle、完整 walk loop、turn、follow 與停止。

### 不要把整體包圍盒當成鞋底

`new THREE.Box3().setFromObject(model).min.y` 不一定是肉眼看到的最低點。蒙皮網格可能包含隱藏頂點、權重變形或匯出殘留幾何。

供應角色優先使用名稱符合 `toe_end` 的骨節點；Three.js 可能清理 glTF node name，例如 `mixamorig:LeftToe_End` 會變成 `mixamorigLeftToe_End`，用 `/toe_end$/i` 比對，不依賴冒號。當前角色腳部參考目標是 `CHARACTER_GROUND_CONTACT_Y = 0.055`；它代表腳趾骨位置，不是鞋底或草面。只有量測證明參考點正確後，才能討論調整。

### 每幀更新動畫後再貼地

骨架動畫會改變腳部 world 座標。角色貼地順序必須是：

1. 更新 `AnimationMixer`。
2. 更新模型 world matrix。
3. 讀取左右腳／腳趾骨節點的 world `y`。
4. 用較低的有效值計算 root correction。
5. 更新角色 root world matrix。
6. 渲染場景。

每幀校正要指定絕對目標，不要累加 offset。若只在載入時貼地，walk loop 仍可能上下漂。

## 走路時倒退、瞬移或循環跳動

這通常是 clip 含 root motion，而 scene steering 也在移動 actor root。先直接解析最終 GLB 的 `root`、`Armature`、`Hips`、`Pelvis` translation accessor；不要只看 Blender F-curve。

角色的 walk clip 必須是 in-place：世界水平移動由 steering 負責，動畫只做步態。可使用 `createInPlaceAnimationClip()` 的 defensive normalization，但不能用每幀反向位移掩蓋輸出資產問題。若循環接縫仍跳動，再檢查 clip 首尾姿勢、duration、root rotation 與 scene transition。

## 停下時閃爍或短暫出現 T-pose

只有 Walk clip 的角色沒有真正 idle。直接停止 action 可能露出 bind pose；重複 `reset()`、`fadeIn()` 或建立新 action 會造成閃爍。

- 有 authored Idle：在 Idle 與 Walk 間使用現有 cross-fade contract。
- 只有 Walk：將 walk action 停在已驗證的穩定 pose；恢復時從同一 pose 繼續。
- 暫停前先以 `mixer.update(0)` 套用目標時間，再停 action；不要先顯示 bind pose。
- 同一 action 已 active 時，不要重複 `reset()`、`fadeIn()` 或建立另一個 mixer。

若模型在 `getWalkIdlePoseTime()` 的 `4%` duration（下限 `0.033s`）不自然，先檢查 clip 本身，再提出獨立的動畫修正，而不是加 UI workaround。

## 複製角色後動畫有跑但網格不動

`Object3D.clone(true)` 不會完整重映射 `SkinnedMesh.skeleton`。所有蒙皮角色都使用 `SkeletonUtils.clone()`；建立 `AnimationMixer` 時，root 必須是實際加入場景的 cloned model。

辨識訊號：mixer time 持續增加但網格停在 bind pose、第一個 actor 正常而第二個變形、或移除來源模型後 clone 動畫失效。檢查 model source cache、clone、mixer root 與 dispose 的 owner 是否唯一。

## 角色上下彈、浮動或陰影誤導

不要同時疊加骨架步態、手寫 bob 與每幀貼地。骨架動畫負責步態；貼地函式負責腳部接觸；若需要輕微 `rotation.z`，reduced-motion 必須停用。

陰影不能取代正確貼地。先讓腳部幾何位於草地基準，再調整 renderer shadow 的大小、透明度與品質。若陰影離腳太遠，角色仍會像浮空；先追查 model transform、腳部 reference 與 shadow owner。

## 畫面閃爍、重影或模型時有時無

- 整個場景重複閃動：檢查是否建立多個 `requestAnimationFrame` 或 runtime 未 dispose。
- 切換面板後才閃動：檢查 React effect dependency、scene key 與 loader 是否重建場景。
- 姿勢閃動：檢查 action reset、cross-fade 與 walk-only fallback。
- 表面斑駁：檢查重疊平面造成的 z-fighting。
- 透明邊緣排序錯誤：檢查 `transparent`、`depthWrite`、`depthTest`、`renderOrder`。
- HMR 後貼圖錯誤：先乾淨 reload，避免把失效 blob URL 誤判為產品問題。

Runtime dispose 必須取消 animation frame、timer、事件 listener 與未完成的 GLTF load，並釋放 tracked roots、materials 與 textures；不要用強制 WebGL context loss 當一般清理。

## AI 修改角色前的證據流程

1. 閱讀 `AGENTS.md`、`CSS_RULES.md` 與本文件。
2. 用 `rg` 找角色 asset、animation、grounding 與 scene lifecycle 的唯一 owner。
3. 固定角色、模型、鏡頭、viewport、quality、reduced-motion 與 animation state。
4. 保存 before screenshot、console、GLB hash 與測量值。
5. 量測 bounds、腳趾／腳部骨節點、root、actor y、mixer time 與地面高度。
6. 先寫會失敗的純函式或 runtime contract test；不要先加 offset。
7. 一次只修一個已證明的根因；不要同時改 CSS、asset、runtime 與 metadata。
8. 用同一場景重測 idle、walk、turn、follow、stop、quality 與 panel pause/resume。
9. 完整驗證並保留可精準 revert 的 commit。

## 完成前檢查

- [ ] 角色鞋底位於草地基準，沒有浮空或沉入身體
- [ ] idle 與 walk 都維持接觸
- [ ] animation loop 沒有倒退、瞬移或首尾跳動
- [ ] 停止沒有 T-pose 或單幀閃爍
- [ ] 多個 actor 不會共用錯誤 skeleton／mixer
- [ ] panel 開關、HMR 與 loader abort 後沒有重複 runtime
- [ ] reduced-motion、low quality 與 renderer shadow 行為符合 contract
- [ ] console 沒有新的 error 或 warning
- [ ] 臨時診斷 log、data attribute 與測試資產已移除
- [ ] `npm run lint`、`npm test`、`npm run build`、`npm run security:check`、`git diff --check` 結果已回報
