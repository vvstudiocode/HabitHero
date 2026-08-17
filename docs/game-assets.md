# Game assets

For runtime grounding, walking animation, skeleton cloning, flicker, and visual verification, follow [the character and pet 3D troubleshooting guide](./character-pet-3d-troubleshooting.md).

## 動畫資產規則

所有會放進世界巡遊的 `Walk` 動畫都必須是原地走路（`Walk_InPlace`）：動畫只能做腿部與身體步態，不得在 `root`、`Armature`、`Hips` 或 `Pelvis` 的水平 `x/z` 軸帶入前進位移。世界 steering 會負責寵物與角色的位置；若動畫也前進，循環接縫會看起來像回到原點或倒退。匯出前要固定這些 root-motion track，runtime 的 `createInPlaceAnimationClip()` 也會再做一次防護。

所有巡遊寵物停下後，有作者提供 `Idle` 動畫的寵物會每次隨機待機 3–5 秒，沒有 `Idle` 的舊寵物則使用 walk-only 的穩定停步姿勢。收到開始走路的狀態後，不強制截斷 authored Idle：先寫入 `movePending`，至少完整播放一輪，等自然循環結束點再切換到走路，並使用約 200ms crossfade。這樣不會因為等待計時器或動畫循環接縫而突然跳姿勢；沒有 Idle 的寵物也使用每次隨機 3–5 秒停步。

## Supplied characters

The character shop uses ten user-provided, mobile-optimized GLBs under `public/assets/characters/`: `arthur.glb`, `elina.glb`, `sia.glb`, `elio.glb`, `moss.glb`, `noah.glb`, `collette.glb`, `violette.glb`, `gilt.glb`, and `lunalia.glb`. All files contain the merged authored `Idle` and in-place `Walk_InPlace` clips. Models use Draco-compressed geometry and WebP textures, with transparent 512px WebP thumbnails beside the models.

World character models share the `warm-hand-painted` runtime material preset: their original textures remain unchanged while reflections are softened, roughness is increased, and a subtle cream-warm tint is applied for a consistent storybook animation look.

## Forest Guardian pet

`public/assets/starlight-sprout-pet.glb` is the user-provided Starlight Sprout biped model presented in the store as `森林守護者`. Its matching transparent store thumbnail is `public/assets/forest-guardian-thumbnail.png`. The store entry keeps the stable `pet.starlight-sprout` key and the world runtime loads its embedded materials and walking animation through the same GLTF/SkeletonUtils path as the other 3D characters. Bounds normalization keeps the pet at the existing star-sprout world scale, with a 1.3x in-world visual size multiplier for the equipped and roaming model, despite the source file's authored armature scale.

The replacement migration (`20260812101223_replace_legacy_pets_with_starlight_sprout.sql`) removes all previous pet catalog rows, prices, inventory, world entities, purchases, and purchase ledger entries before inserting the single active pet. The rename migration (`20260812103059_rename_starlight_sprout_to_forest_guardian.sql`) updates the display name, while `20260812104044_update_forest_guardian_thumbnail.sql` points the catalog at the supplied transparent thumbnail. The supplied model's original source/license provenance should be recorded before a production distribution.

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

## 星辰潛者、尼布斯與克里斯多

`public/assets/pets/star-diver.glb`、`public/assets/pets/nibus.glb` 與 `public/assets/pets/christo.glb` 都使用 Draco 幾何壓縮、WebP 貼圖與原地 `Walk_InPlace` 動畫。星辰潛者的 Hips 水平 root motion 已在 GLB 匯出時清除，並與尼布斯、克里斯多一樣使用 `groundOffset=-0.22`、`nameLabelPlacement=above-head`、0.55 名稱比例與自製橢圓標記關閉設定；太陽陰影仍保留。尼布斯使用 `Idle` 與 `Walk_InPlace`，世界巡遊速度為一般寵物的一半、顯示尺寸為原設定的 2 倍，名稱比例為 0.55、地面陰影比例為 0.22。克里斯多目前也使用 2 倍模型、0.55 名稱比例與 0.22 地面陰影比例。泰迪酥已從商店與本地 GLB/縮圖資產移除；若遠端有歷史購買或持有紀錄，catalog row 會保留但停用以維持帳務可追溯性。

## 莫可與卡爾多

`public/assets/pets/moko.glb` 與 `public/assets/pets/kaldo.glb` 由使用者提供的 `莫可.fbx`／`莫可idle.fbx`、`卡爾多.fbx`／`卡爾多Idle.fbx` 合併而成，商店 keys 分別為 `pet.moko` 與 `pet.kaldo`。兩個 GLB 都包含 `Idle` 和原地 `Walk_InPlace`，匯出時固定 root／Hips 的水平位移，並在 GLB accessor 層再次固定 Walk clip 的 root x/z，避免 FBX/骨架取樣在轉檔後重新產生前進位移。模型使用 Draco 幾何壓縮、WebP 貼圖與行動版網格簡化；莫可約 1.84 MB／91,027 triangles，卡爾多約 1.61 MB／163,544 triangles。

兩隻新寵物沿用目前人物放入世界的呈現規則：`hideGroundMarker=true`（關閉 runtime 自製橢圓標記）、`hideGroundShadow=false`（保留太陽投影）、地面陰影比例 0.22、名稱比例 0.55，以及有 authored Idle 時每次隨機待機 3–5 秒。莫可待機使用 `groundOffset=-0.22`，只有 Walk action 啟用時額外使用 `walkingGroundOffset=-0.04`，避免走路腳底稍微離開草地；卡爾多整體使用 `groundOffset=-0.36`。莫可現在使用 2 倍模型，卡爾多使用 4 倍模型；名稱仍維持統一的世界尺寸，不會因模型放大而變成巨大的浮字。兩個 GLB 的 root-motion 後處理只在原始 GLB binary chunk 內覆寫 Walk 的 root x/z，不重新封裝 JSON／BIN chunk；這是避免 Three.js 載入成功但模型不渲染的必要細節。新增人物或寵物時，先檢查來源動畫是否含 root motion，再以這套 GLB、metadata、場景 signature 與 Supabase migration 流程處理。

## 奧利安

`public/assets/pets/orian.glb` 與 `public/assets/pets/orian-thumbnail.png` 由使用者提供的 `奧利安.fbx`／`奧利安idle.fbx` 合併而成，商店 key 為 `pet.orian`。模型包含 `Idle` 與原地 `Walk_InPlace`，使用 Draco、WebP 與 0.2 網格簡化，約 1.90 MB／118,615 triangles；透明縮圖為 512×512 RGBA。它沿用 `groundOffset=-0.22`、關閉自製橢圓標記、保留太陽陰影、陰影比例 0.22、名稱比例 0.55 與每次 3–5 秒的 Idle 待機，模型顯示尺寸為原設定的 2 倍。
`public/assets/pets/oum.glb` 與 `public/assets/pets/oum-thumbnail.webp` 由使用者提供的 `歐姆.fbx`／`歐姆 Idle.fbx` 合併而成，商店 key 為 `pet.oum`。模型包含 `Idle` 與原地 `Walk_InPlace`，使用 Draco、1024px WebP 貼圖與 0.12 網格簡化，約 1.12 MB／78,832 render vertices；透明縮圖為 512×512 WebP。它沿用 `groundOffset=-0.32`、關閉自製橢圓標記、保留太陽陰影、陰影比例 0.22、名稱比例 0.55 與每次 3–5 秒的 Idle 待機。

## 阿卡迪亞

`public/assets/pets/arcadia.glb` 與 `public/assets/pets/arcadia-thumbnail.webp` 由使用者提供的 `阿卡迪亞.fbx`／`阿卡迪亞Idle.fbx` 合併而成，商店 key 為 `pet.arcadia`。模型包含 `Idle` 與原地 `Walk_InPlace`，使用 Draco、1024px WebP 貼圖與 0.16 網格簡化，約 862 KB／47,103 triangles；透明縮圖為 512×512 WebP。它使用 `groundOffset=-0.50`、顯示尺寸倍率 6.8、關閉自製橢圓標記、保留太陽陰影、陰影比例 0.22、名稱比例 0.55 與每次 3–5 秒的 Idle 待機。6.8 倍設定會同時套用到巡遊與跟隨 actor，兩者仍共用原本的模型快取、碰撞與追蹤距離計算。對應 catalog migrations 為 `20260816065247_add_arcadia_pet.sql`、`20260816075304_tune_arcadia_pet_visual_scale.sql`、`20260816075918_tune_arcadia_pet_visual_scale_6_8.sql`、`20260816080341_lower_arcadia_to_grass.sql` 與 `20260816081707_tune_arcadia_oum_ground_contact.sql`。

## 寵物浮空、陰影與巡遊隨機化心得

模型底下的橢圓形不是太陽光陰影，而是 runtime 額外建立的 ground marker。現在以 `hideGroundMarker` 單獨關閉它，不再誤用 `hideGroundShadow` 連真正的模型投影也關掉；因此 supplied pets 仍會留下場景太陽陰影。模型浮空則用 catalog metadata 的負 `groundOffset` 修正；若只有 Walk clip 的骨架在動作中抬高，才另外使用 `walkingGroundOffset`，不影響待機高度。這次莫可採待機 `-0.22`、走路額外 `-0.04`，卡爾多整體 `-0.36`。名稱統一使用 Sprite 放在模型頭頂：`nameLabelPlacement='above-head'`，位置是模型未縮放高度 `definition.size.y` 加上 `PET_NAME_LABEL_HEAD_GAP=0.22`；材質使用 `depthTest=false`、`depthWrite=false`，避免被草或模型遮住。名稱世界尺寸使用 `nameLabelScaleMultiplier=0.55`，並以模型 root scale 的反比換算 local scale，所以莫可 2 倍、卡爾多 4 倍、奧利安 2 倍，以及其他放大寵物都不會讓名字跟著失控變大。

這些 metadata 會納入 `TerrainWorldLayer` 的 scene signature。Supabase 或背景 refresh 更新模型比例、ground offset、陰影或名稱設定時，世界場景會重建並立即套用；否則只更新 catalog 資料而沿用舊 Three.js scene，畫面會看起來像設定沒有生效。

有 authored `Idle` 的寵物每次隨機停留 3–5 秒；沒有 `Idle` 的 walk-only 寵物也使用每次隨機停留 3–5 秒。寵物初始位置不再固定落在世界外圈，而是用每隻寵物 index 產生可重現但不同的 mid-field 隨機點，半徑約 1.15–2.75，並避開玩家起點、樹與其他寵物；這樣畫面一開始就是分散的，不會全部從外側往中心集中。巡遊的初始停走時間、轉向時間、停頓開始間隔與探索目標間隔都由每隻寵物自己的 seeded random stream 產生（轉向約 1.4–3.2 秒、停頓間隔約 4.2–8.5 秒、探索間隔約 12–18 秒），讓寵物不會同時停下像木頭人；seeded 只代表每隻寵物有穩定但彼此不同的隨機節奏。

待機切換的實作心得：動畫 action 建立時只把 walk-only action 固定在穩定停步 pose；有 authored Idle 的 action 從時間 0 開始播放，不能再呼叫 `pauseAnimationAtIdlePose()`。每個 actor 保存 `idleCycleElapsed` 與 `movePending`；巡遊 steering 決定行走時只排程，不立即換 action，`advancePetIdleCycle()` 跨過 clip duration 後才換到 Walk。action 交換用 `crossFadeFrom(previousAction, 0.2, true)`，避免把上一個 action 立即 pause 導致 crossfade 失效。這套規則就是之後新增人物或寵物的預設參考。
