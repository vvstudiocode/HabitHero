# 莫可 GLB 五動作整合流程

這份文件記錄莫可的可重複整合方式：一個 base FBX 提供模型、材質、貼圖與骨架，其餘 FBX 只提供 animation。輸出一個共用 mesh／texture 的 GLB，避免每個動作重複打包幾何與貼圖。

## 本次輸出

| 項目 | 值 |
| --- | --- |
| Catalog key | `pet.moko` |
| Model | `public/assets/pets/moko.glb` |
| Thumbnail | `public/assets/pets/moko-thumbnail.png`（沿用既有縮圖） |
| Base model | `莫可Idle.fbx` |
| Action sources | `莫可.fbx`、`莫可坐下.fbx`、`莫可揮手.fbx`、`莫可跳舞.fbx` |
| Clips | `Idle`、`Walk_InPlace`、`Sit`、`Wave`、`Dance` |
| GLB size | 1,457,608 bytes（約 1.39 MiB） |
| Geometry | 72,821 triangles；Draco compression |
| Texture | 1024px cap；WebP quality 82 |

## 匯出方式

完整腳本位於 `tools/export_moko_action_assets.py`：

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python tools/export_moko_action_assets.py
```

腳本會：

1. 用 `莫可Idle.fbx` 建立唯一的 armature、skinned mesh、材質與貼圖。
2. 從另外四個 FBX 複製 action，刪除它們帶入的暫存 armature 與 mesh。
3. 將 action 改成固定名稱：`Walk_InPlace`、`Sit`、`Wave`、`Dance`。
4. 固定 `mixamorig:Hips`／`Pelvis` 的水平 root translation；世界 runtime 負責寵物實際移動。
5. 對唯一 base mesh 做 0.20 行動版 decimation，將貼圖長邊限制在 1024px。
6. 以 GLB、Draco level 6、WebP texture 與 animation size optimization 輸出。

原始 FBX 不會被修改；輸出只會替換 `public/assets/pets/moko.glb`。本地 asset manifest 已沿用既有的 `/assets/pets/moko.glb` 路徑，因此不需要新增第二個 Moko key。

## Supabase catalog metadata

對應 migration 是 `supabase/migrations/20260818103000_replace_moko_with_five_actions.sql`。它記錄五個 clip、原地走路規則、共用 mesh、compression 與實際 `modelBytes`。這次只新增本地 migration 檔，沒有在未經確認下直接修改遠端 Supabase。

## 驗證清單

```bash
npx tsx --test tests/moko-multi-animation-glb.test.ts
npx tsx --test tests/moko-kaldo-pets.test.ts tests/moko-kaldo-ground-contact.test.ts
npm run lint
npm test
npm run build
```

GLB 必須同時符合：

- magic 是 `glTF`。
- animation names 包含五個 canonical clips。
- 只有一個 mesh 與一張 texture。
- 啟用 `KHR_draco_mesh_compression` 與 `EXT_texture_webp`。
- `Walk_InPlace` 的水平 root translation 維持原地。
- 檔案小於 2 MiB，避免增加行動版 app 容量。
