# 尼布斯 GLB 五動作整合注意事項

## 來源與輸出

| 項目 | 路徑 |
| --- | --- |
| Base model | `/Users/studio.vv/Desktop/habithero動作檔/尼布斯Sad Idle.fbx` |
| Walk | `/Users/studio.vv/Downloads/尼布斯.fbx` |
| Sit | `/Users/studio.vv/Desktop/habithero動作檔/尼布斯坐下.fbx` |
| Wave | `/Users/studio.vv/Desktop/habithero動作檔/尼布斯揮手.fbx` |
| Dance | `/Users/studio.vv/Desktop/habithero動作檔/尼布斯跳舞.fbx` |
| Output | `public/assets/pets/nibus.glb` |
| Clips | `Idle`, `Walk_InPlace`, `Sit`, `Wave`, `Dance` |

`尼布斯.fbx` 的 Walk 原始檔沒有位移。不能只檢查 Blender 內的 F-curve；FBX 匯出成 glTF 後，`mixamorig:Hips` 的 translation accessor 仍可能出現 Y 軸位移。因此匯出前與匯出後都要做正規化，最終 GLB 的根 translation X/Y/Z range 都必須不大於 `0.0005`。

## 必做流程

1. 以 `尼布斯Sad Idle.fbx` 建立唯一的 armature、skinned mesh、材質與貼圖。
2. `尼布斯.fbx`、坐下、揮手、跳舞檔案只複製 action，不要保留它們帶入的暫存 mesh／armature。
3. Walk 命名為 `Walk_InPlace`。
4. 匯出前固定 Hips／Pelvis 的 Blender location 三軸。
5. 匯出後直接讀 GLB binary accessor，再固定 Walk 的 `root`／`Armature`／`Hips`／`Pelvis` translation X/Y/Z；不要重建 JSON 或重新排列 buffer。
6. 驗證五段 clip、Draco、WebP，以及每個 Walk 根 translation track 的三軸 range。

重打包指令：

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python tools/export_nibus_action_assets.py
```

驗證指令：

```bash
npx tsx --test tests/nibus-pet.test.ts tests/christo-pet-and-in-place-animation.test.ts
```

不要修改原始 FBX；只替換 `public/assets/pets/nibus.glb`，並同步更新 Nibus catalog migration 的 `modelBytes` 與本文件。
