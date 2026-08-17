# 茉莉 GLB 五動作整合流程

這份文件記錄 `茉莉` 的可重複整合方法，供之後的 AI 或開發者把同一角色的多個 FBX 動作合併成一個小而完整的 GLB。目標是「一份模型、共用一份材質與貼圖、保留五個 animation clip」，不要輸出五個各自重複模型的 GLB。

## 本次輸出結果

| 項目 | 值 |
| --- | --- |
| Catalog key | `pet.jasmine` |
| Model | `/Users/studio.vv/Desktop/HabitHero/public/assets/pets/jasmine.glb` |
| Thumbnail | `/Users/studio.vv/Desktop/HabitHero/public/assets/pets/jasmine-thumbnail.png` |
| Source model/action files | `/Users/studio.vv/Downloads/茉莉Idle.fbx`、`茉莉walk.fbx`、`茉莉坐下.fbx`、`茉莉揮手.fbx`、`茉莉跳舞.fbx` |
| Clips | `Idle`、`Walk_InPlace`、`Sit`、`Wave`、`Dance` |
| GLB size | 約 786 KB |
| Compression | Draco geometry + WebP texture + 1024px texture cap |
| Mesh reduction | Jasmine mesh decimate ratio `0.20` |

## 正確做法

1. 選一個包含完整模型、材質、貼圖與骨架的 FBX 當 base。茉莉使用 `茉莉Idle.fbx`。只從其他 FBX 取 animation，不要再次把它們的 mesh、材質或貼圖加入場景。
2. 確認所有 FBX 使用同一套 Mixamo skeleton。若骨架名稱或 bone hierarchy 不一致，先處理 retarget；不要直接把不同骨架的 action 疊到 base armature。
3. 將 base FBX import 一次，保留一個 armature 與一個 skinned mesh。
4. 逐一 import 其他動作 FBX，複製它們的 action 到 base armature 後，立即刪除這些 FBX 帶進來的暫存 armature 與 mesh。
5. 把 action 改成穩定的 canonical names：
   - 待機：`Idle`
   - 走路：`Walk_InPlace`
   - 坐下：`Sit`
   - 揮手：`Wave`
   - 跳舞：`Dance`
6. `Walk` 必須先做 root-motion normalization。固定 `mixamorig:Hips`／`Pelvis` 的水平位移；Blender FBX import 後水平面是 X/Y，匯出 glTF Y-up 後會對應 glTF X/Z。不要固定 Blender Z，否則仍可能把前進位移帶進 GLB。
7. 只對 base mesh 做行動版簡化；先確定 modifier 在 Armature modifier 前面，再 apply Decimate。保留 UV、材質分區、法線與 skin weights。
8. 貼圖長邊限制在 1024px，使用 WebP quality 約 84。縮圖另輸出 512×512 RGBA PNG，保留透明背景。
9. 使用 GLB export，開啟 `ACTIONS` animation mode、skin、動畫尺寸最佳化、Draco level 6、WebP 貼圖。輸出後確認只存在一份 mesh／材質／貼圖，而不是每個 action 都複製一份幾何。

## 本專案的自動化腳本

完整流程已固定在：

`/Users/studio.vv/Desktop/HabitHero/tools/export_jasmine_christo_action_assets.py`

執行環境是 Blender 5.x，指令：

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python /Users/studio.vv/Desktop/HabitHero/tools/export_jasmine_christo_action_assets.py
```

腳本會：

- 重設 Blender scene，避免前一次匯入的物件混入。
- 以 `茉莉Idle.fbx` 建立 base model。
- 從其他四個 FBX 只複製 action，然後刪除暫存模型。
- 將走路 action 做 in-place 修正。
- 對 Jasmine mesh 使用 `0.20` Decimate ratio。
- 限制貼圖、輸出 Draco/WebP GLB。
- 從 `/Users/studio.vv/Downloads/茉莉去背.png` 產生透明 512px 縮圖。

原始 FBX 與 PNG 必須保持不變；輸出只寫入 `public/assets/pets/`。

## Runtime 與 Supabase 必須同步的資料

本地 manifest 要有：

```ts
'pet.jasmine': {
  modelUrl: '/assets/pets/jasmine.glb',
  thumbnailUrl: '/assets/pets/jasmine-thumbnail.png',
}
```

Catalog metadata 至少要記錄：

```json
{
  "model": "/assets/pets/jasmine.glb",
  "animationClips": ["Idle", "Walk_InPlace", "Sit", "Wave", "Dance"],
  "animationStates": ["idle", "walk", "sit", "wave", "dance"],
  "rootMotion": "in-place",
  "compression": "Draco mesh compression + 1024px WebP texture",
  "visualScaleMultiplier": 2,
  "groundOffset": -0.22,
  "hideGroundShadow": true,
  "hideGroundMarker": true
}
```

`visualScaleMultiplier` 是 runtime 的相對倍率，不要直接修改 GLB 的骨架或 mesh scale。`groundOffset` 必須在放大後再確認腳底是否落在草地基底；若只在原始尺寸看，放大後很容易又站到草尖。茉莉要求不顯示陰影，因此同時關閉 runtime 自製 marker 與模型投影。

### 茉莉目前的最終驗證結果

茉莉套用 2 倍顯示倍率後，使用 `groundOffset=-0.22` 將腳底壓回草地基底，不使用原始尺寸的 0 偏移；這個設定是以放大後的 world actor 為準，避免角色停在草尖。模型本身不投射／接收陰影（`hideGroundShadow=true`），runtime 額外建立的地面橢圓標記也關閉（`hideGroundMarker=true`）。對應設定已寫入 `20260818090000_tune_jasmine_pet_presentation.sql`，並已同步遠端 catalog。

本次 catalog migration：

- `supabase/migrations/20260818080000_add_jasmine_and_christo_actions.sql`
- `supabase/migrations/20260818090000_tune_jasmine_pet_presentation.sql`

## 匯出後驗證清單

```bash
npx tsx --test /Users/studio.vv/Desktop/HabitHero/tests/jasmine-christo-action-assets.test.ts
npx tsx --test /Users/studio.vv/Desktop/HabitHero/tests/christo-pet-and-in-place-animation.test.ts
npm run lint
npm run build
```

另外用 GLB parser 檢查：

- magic 是 `glTF`。
- animation names 恰好包含五個 canonical names。
- `Walk_InPlace` 的 root translation X/Z range 接近 0。
- GLB 含 `KHR_draco_mesh_compression` 與 `EXT_texture_webp`。
- 沒有多餘的 duplicate mesh／texture。
- 縮圖是 RGBA，且透明背景沒有被黑底取代。
- app 的 `game-content-assets.ts`、catalog migration、測試與文件都指向同一個 asset key/path。

若五個 action 暫時無法共用同一套 skeleton，先停止合併並處理 retarget；不要為了快速完成而輸出五個重複模型，因為那會把網格、材質與貼圖重複計入 app 容量。
