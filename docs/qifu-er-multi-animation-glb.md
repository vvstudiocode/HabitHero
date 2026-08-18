# 齊福爾 GLB 五動作整合注意事項

## 來源與輸出

| 項目 | 路徑 |
| --- | --- |
| Base model | `/Users/studio.vv/Downloads/齊福爾Idle.fbx` |
| Walk | `/Users/studio.vv/Downloads/齊福爾.fbx` |
| Sit | `/Users/studio.vv/Downloads/齊福爾坐下.fbx` |
| Wave | `/Users/studio.vv/Downloads/齊福爾揮手.fbx` |
| Dance | `/Users/studio.vv/Downloads/齊福爾跳舞.fbx` |
| Output | `public/assets/pets/qifu-er.glb` |
| Clips | `Idle`, `Walk_InPlace`, `Sit`, `Wave`, `Dance` |

`齊福爾.fbx` 的 Walk 原始檔本身沒有位移。注意：不能只檢查 Blender 內的 F-curve；Blender 5 匯出 glTF 時可能因 FBX／glTF 軸向轉換，讓 `mixamorig:Hips` 的 translation accessor 在 GLB 裡重新出現位移。

## 必做的原地走路檢查

1. 以 `齊福爾Idle.fbx` 建立唯一的 armature、skinned mesh、材質與貼圖。
2. 其他四個 FBX 只複製 action，刪除它們帶入的暫存 armature 與 mesh。
3. Walk 命名為 `Walk_InPlace`。
4. 匯出前固定 Hips／Pelvis 的 Blender location 三軸。
5. 匯出後直接讀 GLB binary accessor，對 Walk 的 `root`／`Armature`／`Hips`／`Pelvis` translation 固定 X/Y/Z 三軸；不要重建 JSON 或重新排列 buffer。
6. 驗證每個根 translation track 的 X、Y、Z range 都不大於 `0.0005`。只驗證 X/Z 不夠，這次問題就是 GLB 出現 Y 軸位移。

重打包指令：

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python tools/export_qifu_er_action_assets.py
```

驗證指令：

```bash
npx tsx --test tests/qifu-er-pet.test.ts
```

不要修改 Downloads 內的原始 FBX；只替換 `public/assets/pets/qifu-er.glb`，並同步確認 `docs/game-assets.md`、catalog migration 與資產測試仍記錄同一份輸出。
