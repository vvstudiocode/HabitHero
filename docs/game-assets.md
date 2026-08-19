# Game assets

For supplied-character grounding, walking animation, skeleton cloning, flicker, and visual verification, follow [the character 3D troubleshooting guide](./character-pet-3d-troubleshooting.md). Pet asset integration follows the single canonical link in the Supplied pets section below.

## Animation asset index

角色與寵物的動畫資產文件入口：角色看 troubleshooting；寵物整合規則見 Supplied pets 的 canonical link。現有 authored Idle 寵物的 golden baseline 是每次約 `3–5 秒` 待機；本索引不重述其他整合規則。

## Supplied characters

The character shop uses ten user-provided, mobile-optimized GLBs under `public/assets/characters/`: `arthur.glb`, `elina.glb`, `sia.glb`, `elio.glb`, `moss.glb`, `noah.glb`, `collette.glb`, `violette.glb`, `gilt.glb`, and `lunalia.glb`. All files contain the merged authored `Idle` and in-place `Walk_InPlace` clips; the action-enabled character bundles also include `Sit`, `Wave`, and `Dance`. Models use Draco-compressed geometry and WebP textures, with transparent 512px WebP thumbnails beside the models.

`public/assets/characters/violette.glb` now packs `薇歐莉特Idle.fbx`, `薇歐莉特.fbx`, `薇歐莉特坐下.fbx`, `薇歐莉特揮手.fbx`, and `薇歐莉特跳舞.fbx` into one shared-mesh GLB. It contains `Idle`, `Walk_InPlace`, `Sit`, `Wave`, and `Dance`, and is approximately 1.16 MB after Draco/WebP compression and 0.12 mesh simplification; the corresponding catalog metadata is updated by `20260818220000_replace_violette_with_five_actions.sql`.

`public/assets/characters/gilt.glb` now packs `吉爾特Idle.fbx`, `吉爾特.fbx`, `吉爾特坐下.fbx`, `吉爾特揮手.fbx`, and `吉爾特跳舞.fbx` into one shared-mesh GLB. It contains the same five clips and is approximately 1.24 MB after Draco/WebP compression and 0.12 mesh simplification; the corresponding catalog metadata is updated by `20260818230000_replace_gilt_with_five_actions.sql`.

`public/assets/characters/lunalia.glb` now packs `露娜莉亞idle.fbx`, `露娜莉亞.fbx`, `露娜莉亞坐下.fbx`, `露娜莉亞揮手.fbx`, and `露娜莉亞跳舞.fbx` into one shared-mesh GLB. It contains the same five clips and is approximately 1.31 MB after Draco/WebP compression and 0.12 mesh simplification; the corresponding catalog metadata is updated by `20260818074452_replace_lunalia_with_five_actions.sql`.

World character models share the `warm-hand-painted` runtime material preset: their original textures remain unchanged while reflections are softened, roughness is increased, and a subtle cream-warm tint is applied for a consistent storybook animation look.

## Supplied pets

寵物的 model／thumbnail inventory、目前 shipped GLB 與 metadata snapshot，及未來五個 FBX → 單一多動作 GLB 的唯一整合流程，請閱讀 [`docs/pet-system.md`](./pet-system.md)。本文件只保留資產索引，不再重述 action-only import、root motion、ground／shadow tuning 或個別寵物的匯出步驟。

`public/assets/starlight-sprout-pet.glb` 與 `public/assets/forest-guardian-thumbnail.png` 是商店 `pet.starlight-sprout`／`森林守護者` 的既有資產；`星辰潛者`、尼布斯、克里斯多等 supplied pet model 位於 `public/assets/pets/`，canonical key／path 由 local asset registry 與 catalog metadata 共同核對。若新增或替換寵物，先完成 [`docs/pet-system.md`](./pet-system.md) 的 source、hash、骨架、clip、GLB 與 presentation checklist，再另開資產變更任務。

## Static furniture and world decorations

臥室家具與世界裝飾是可直接放入世界裝飾系統的靜態 GLB。使用既有 catalog key 與 metadata，不要為同一個模型建立另一組名稱或路徑；AI 要新增家具時，先查 `game_catalog_items` 的 `item_type='decoration'`，再依 `asset_key` 載入模型。

### Current decoration rules

這一節是目前實作的裝飾規則來源；若舊 plan、舊 migration 或錯誤訊息與這裡不同，以目前最後一個 migration、runtime 與測試的結果為準。

- 只有 `item_type='decoration'` 的裝飾彼此允許重疊。放置流程與 Supabase `validate_world_transform` 都不再做 decoration-to-decoration overlap rejection；這不是把所有世界物件的碰撞都關掉。
- 裝飾仍必須通過可見草地邊界、角色出生點、中央大樹保護區與 catalog 的 `min_scale`／`max_scale` 驗證。
- `collision_radius` 必須保持正值，供資料庫邊界與有效性檢查使用；不要把它設成 `0` 來表示可重疊。
- `metadata.navigationRadius` 是人物／寵物在 runtime 使用的較小導航碰撞 proxy。它可以小於 `collision_radius`，讓人物靠近模型但仍不能穿過。
- `metadata.navigationInset` 預設為 `0.25`，會縮短人物／寵物與裝飾之間的視覺安全距離；它只內縮角色碰撞半徑，不會移除裝飾形狀，也不允許角色中心穿過模型。
- `metadata.collisionShape` 定義人物／寵物碰撞的幾何形狀：牆壁、床、書桌與書櫃使用 `rectangle`，椅子、床頭櫃與噴泉使用 `circle`；需要時可用 `capsule` 搭配 `collisionLength` 與 `collisionAxis`。
- 長方形的 `collisionWidth`／`collisionDepth` 與膠囊形的 `collisionLength` 都以模型 scale=1 的世界單位記錄，runtime 會跟著裝飾縮放與 `rotationY` 旋轉。
- 新增裝飾時必須同步更新：`public/assets/decorations/`、`src/features/world/game-content-assets.ts`、Supabase catalog migration、資產契約測試與本文件。
- migration 必須用 `npx supabase migration new ...` 建立，並在遠端部署後確認 migration history、catalog row 與最新 RPC 函式定義。

| Catalog key | 名稱 | Model | Thumbnail | 預設縮放 | 允許縮放 | Ground offset | `collision_radius` | `navigationRadius` | `navigationInset` | 碰撞形狀 | Scroll price |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| `decoration.study-desk` | 木製書桌 | `public/assets/decorations/study-desk.glb` | `public/assets/decorations/study-desk-thumbnail.png` | `0.62` | `0.1–0.8` | `0.713` | `0.74` | `0.58` | `0.25` | rectangle | 6 |
| `decoration.bookcase` | 木製書櫃 | `public/assets/decorations/bookcase.glb` | `public/assets/decorations/bookcase-thumbnail.png` | `0.4` | `0.1–0.65` | `1` | `0.66` | `0.48` | `0.25` | rectangle | 7 |
| `decoration.study-chair` | 木製椅子 | `public/assets/decorations/study-chair.glb` | `public/assets/decorations/study-chair-thumbnail.png` | `0.36` | `0.1–0.65` | `1` | `0.5` | `0.36` | `0.25` | circle | 5 |
| `decoration.bed` | 木製床 | `public/assets/decorations/bed.glb` | `public/assets/decorations/bed-thumbnail.png` | `0.82` | `0.35–1.15` | `0.426` | `1.05` | `0.56` | `0.25` | rectangle | 10 |
| `decoration.nightstand` | 床頭櫃 | `public/assets/decorations/nightstand.glb` | `public/assets/decorations/nightstand-thumbnail.png` | `0.5` | `0.25–0.8` | `1` | `0.52` | `0.32` | `0.25` | circle | 6 |
| `decoration.adventure-table` | 冒險桌 | `public/assets/decorations/adventure-table.glb` | `public/assets/decorations/adventure-table-thumbnail.png` | `0.5` | `0.25–0.9` | `0.5455` | `0.78` | `0.48` | `0.25` | circle | 9 |
| `decoration.fountain` | 噴泉 | `public/assets/decorations/fountain.glb` | `public/assets/decorations/fountain-thumbnail.png` | `0.45` | `0.25–0.75` | `1` | `0.68` | `0.4` | `0.25` | circle | 8 |
| `decoration.curtain-wall` | 窗簾牆 | `public/assets/decorations/curtain-wall.glb` | `public/assets/decorations/curtain-wall-thumbnail.webp` | `0.72` | `0.25–1.5` | `0.6102` | `0.28` | `0.28` | `0.25` | rectangle | 8 |
| `decoration.wall` | 牆壁 | `public/assets/decorations/wall.glb` | `public/assets/decorations/wall-thumbnail.webp` | `0.72` | `0.25–1.5` | `0.6309` | `0.28` | `0.28` | `0.25` | rectangle | 6 |

### AI decoration loading rules

- `model` 與 `thumbnail` 路徑以本機 manifest 與 catalog metadata 為準；縮圖可以是 PNG，也可以是含透明通道的 WebP。
- 這些 GLB 是靜態家具／場景裝飾，沒有角色骨架或動畫，不要套用 character/pet 的 `SkeletonUtils.clone()`、walk、idle 或 root-motion 流程。
- 放置時沿用 catalog 的 `defaultScale`、`groundOffset`、`collision_radius`、`min_scale`、`max_scale`、`navigationRadius`、`navigationInset` 與形狀欄位；不要在 UI 或 runtime 另外加固定偏移或重新發明一套碰撞半徑。
- 形狀 metadata 欄位固定使用 `collisionShape`、`collisionWidth`、`collisionDepth`、`collisionLength`、`collisionAxis`、`navigationInset`；缺少有效形狀尺寸時才回退到正值圓形 proxy。
- GLB 內含 Draco geometry、1024px WebP textures、`NORMAL`、`TEXCOORD_0` 與 MikkTSpace `TANGENT`。若重新優化，必須保留 UV／法線接縫並重新產生 tangents；不要使用會跨越材質或 UV seam 的 permissive simplification。
- 目前已用 `20260816045548_add_bedroom_decorations.sql` 建立床與床頭櫃、`20260815160614_add_study_room_decorations.sql` 建立書桌／書櫃／椅子、`20260816053842_add_adventure_table_fountain_decorations.sql` 建立冒險桌／噴泉，並用 `20260817000000_add_curtain_wall_decoration.sql` 與後續 wall migrations 建立兩面牆；`20260817090819_configure_decoration_collision_shapes.sql` 設定形狀，`20260817092408_reduce_decoration_navigation_clearance.sql` 與 `20260817093348_increase_decoration_navigation_inset.sql` 設定靠近距離。修改家具模型後，同步更新 migration metadata、對應資產測試與本節數值。
- `/Users/studio.vv/Downloads/床.glb`、`/Users/studio.vv/Downloads/床頭櫃.glb`、`/Users/studio.vv/Downloads/冒險桌.glb` 與 `/Users/studio.vv/Downloads/噴泉.glb` 是原始來源備份，不是 runtime asset；世界與商店只能使用 `public/assets/decorations/` 內的新版檔案。

## Big Tree

`terrain-prototype/assets/big-tree.glb` remains the high-quality source master, while production runtime loads `terrain-prototype/assets/big-tree-optimized.glb`. The optimized GLB keeps the same mesh, UVs, material, and three texture channels, but resamples the three embedded 4096px PNG textures to 2048px; it is 10.72 MB instead of 31.21 MB (about 65.7% smaller). Both quality tiers load the optimized asset because it is part of the browser-visible world; an Anime Maiden GLB is also loaded when that catalog character is equipped, while other characters remain procedural. High quality preserves the prototype visual budget: viewport-aware grass with an outer-density multiplier of 36 plus a 10-layer walkable-edge grass band spread across a wider soft boundary, a fuller base population across the large outer field, the full flower budget, a soft near-white afternoon sun, and a 360-degree ring of softened distant tree silhouettes and hills, pixel ratio capped at 2, and 2048px soft shadows. Low quality (reduced motion, `deviceMemory <= 2`, or `hardwareConcurrency <= 2`) scales the viewport-aware grass and flower budgets down, keeps a reduced outer grass density of 24 with a 6-layer walkable-edge band and a fuller outer-field base population, keeps the 360-degree distant tree silhouettes at low density, caps pixel ratio at 1, reduces sway, and disables renderer shadows. Aborted or disposed loads release their GLTF roots, materials, and textures; failed loads surface the runtime error while the UI keeps its static fallback available. The source master SHA-256 is `c806f86b9b37d13306ef4691cbade2f0c9998bccb78b525900cd3484ff327328`; the optimized asset SHA-256 is `92bb81cc84f168ee5ce1bd5f12b43334e0a432c2ae4567cc58aa58455a1a2746`.

The repository does not currently contain provenance or a license notice for this binary. The asset is therefore an outstanding release/legal risk: record the original source and license beside the asset before distributing a production build.
