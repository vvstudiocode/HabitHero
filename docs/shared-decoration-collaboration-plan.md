# 好友世界永久共享裝飾實作計畫

本文件是 HabitHero「把自己的裝飾永久共享到好友世界，並由雙方共同調整」功能的 canonical 執行規格。其他 AI 開始修改前，必須先讀取根目錄 `AGENTS.md`、`docs/code-maintainability.md`、`docs/game-assets.md`；若修改 CSS，再完整讀取 `CSS_RULES.md`。不得修改既有 GLB、縮圖、寵物資產或已套用 migration history。

目前工作樹可能包含其他人的未提交變更。執行 AI 必須先執行 `git status --short --branch`，只修改本計畫列出的責任，不得 reset、checkout、覆蓋或整理無關變更。所有 Supabase 遠端 migration、push、publish 與部署仍需使用者另行明確批准；本計畫只授權本機程式、migration 檔與測試的實作。

## 1. 目標與完成定義

此功能只處理 `item_type='decoration'`，不包含寵物、人物、聊天、合作冒險或玩家上傳資產。

完成後必須符合：

- 小明擁有一張沙發時，可以在小華明確授權「一起布置」後，把沙發共享到小華世界。
- 共享是永久展示，不是轉移或贈送；小明的庫存與自己世界中的沙發完全不受影響。
- 小華是世界主人，可以移動、旋轉、縮放或移除小華世界中的任何共享裝飾。
- 小明在仍有共同布置權時，可以移動、旋轉、縮放自己共享到小華世界的裝飾。
- 小明無論共同布置權是否被撤銷，都可以撤回自己分享的展示；撤回不影響小華或小明的庫存。
- 其他訪客只能看，不能調整小華或小明的裝飾。
- 世界主人撤銷共同布置權後，既有共享裝飾仍保留，但分享者不能新增或調整；世界主人仍可管理，分享者仍可撤回。
- 解除好友或任一方封鎖對方時，雙方放在彼此世界的共享裝飾全部停止顯示，不轉移所有權。
- 拖曳期間不寫資料庫；只有放置確認、放開後確認、撤回或移除時才呼叫一次 RPC。
- 所有共享裝飾或共同布置權變更都增加「目標世界主人」的 `child_world_states.revision`，沿用既有 `world_revision_v1` 觸發器通知，不新增每幀裝飾 Broadcast。
- 世界快照只傳 `asset_key`、transform 與必要權限投影；GLB 與縮圖繼續由 App 本機資產載入。

## 2. 詞彙與所有權

| 詞彙 | 定義 |
| --- | --- |
| 資產擁有者／分享者 | 購買或取得裝飾 inventory item 的小孩，例如小明 |
| 世界主人 | 共享裝飾所在世界的主人，例如小華 |
| 原生裝飾 | 世界主人自己的 `child_world_entities` 裝飾 |
| 共享裝飾 | 指向分享者 inventory item、但 transform 屬於好友世界的永久展示紀錄 |
| 共同布置權 | 世界主人授予特定好友，可在自己世界新增並調整該好友自己共享裝飾的權限 |
| 撤回分享 | 分享者移除好友世界中的展示，不刪除 inventory item |
| 從世界移除 | 世界主人移除共享展示，不取得、出售或刪除分享者 inventory item |

共享裝飾不是新的庫存數量、禮物、租借或轉移。資料庫不可把共享裝飾插入世界主人的 `child_inventory_items`，也不可降低分享者的 quantity。

## 3. 已解決的矛盾與不直覺點

### 3.1 「永久」不等於「搬走唯一家具」

採用共享展示模型。同一個來源 inventory item 可以繼續出現在分享者自己的世界，也可以在不同好友世界各有一筆共享展示。每個目標好友世界最多一筆同來源 inventory item 的有效展示。

UI 必須使用「分享」「撤回分享」「從我的世界移除」，禁止使用「送出」「轉移」「刪除好友的家具」等會暗示所有權改變的文案。

### 3.2 資產所有權與世界治理權同時成立

- 世界主人永遠能調整或移除自己世界中的共享裝飾。
- 分享者只有在 `can_collaborate=true` 時能新增或調整自己的共享裝飾。
- 分享者永遠能撤回自己的共享展示，避免物品被世界主人鎖住。
- 其他好友即使也是該世界的共同布置者，也不能移動別人分享的裝飾。

### 3.3 撤銷權限不自動刪除既有佈置

撤銷「一起布置」只停止新增與 transform 編輯。自動刪除既有裝飾會讓世界主人誤觸後失去整套佈置，因此既有展示保留。世界主人可個別移除或使用「收起全部好友裝飾」。分享者仍可撤回自己的展示。

### 3.4 解除好友與封鎖必須停止跨家庭展示

解除好友或封鎖後，既有權限不能繼續有效。雙方放在彼此世界的共享展示一律設為 inactive，並各自增加受影響世界的 revision 一次。這比保留「無主家具」更安全，也不會讓解除好友變成免費取得資產的方式。

### 3.5 不公開第三方小孩身份

小華的好友小美可能不是小明的好友。小美參觀小華世界時可以看見共享沙發，但一般世界快照不得向小美透露小明的 profile ID 或顯示名稱。

- 世界主人可在管理 UI 看見「小明分享」。
- 分享者可看見「你分享的」。
- 其他訪客只看見裝飾，不看來源姓名。
- 通用快照以伺服器計算的 `can_transform`、`can_remove`、`shared_by_me` 回傳權限，不讓 client 用來源 ID 自行判斷。

### 3.6 同時移動不建立永久鎖或高頻同步

第一版不顯示「某某正在調整」，也不新增鎖資料表或拖曳 Broadcast。雙方本機拖曳，放開時使用 `expected_revision` 提交；若 revision 已改變，RPC 回傳 conflict，client 重新抓快照並保留本機草稿，提示「世界剛被好友更新，請重新確認位置」。

### 3.7 「全部收起」必須包含畫面上真的看得到的裝飾

既有 `collect_all_world_decorations` 只處理世界主人的原生裝飾。功能完成後，UI 必須區分：

- 「收起我的裝飾」：沿用既有行為。
- 「收起全部好友裝飾」：新增 owner-only RPC，只停用共享展示。

若產品保留單一「全部收起」按鈕，必須由一個新的 transactional RPC 同時處理原生與共享裝飾並只增加一次 revision；禁止 client 串兩個 RPC 冒充原子操作。

### 3.8 共享不製造經濟利益

共享展示不能出售、轉贈、回收成點數、完成收藏條件、增加 quantity 或讓世界主人在商店視為已擁有。只有分享者 inventory 中仍有 `quantity > 0` 且 catalog item 仍為 active decoration 時，展示才有效。

## 4. 權限矩陣

| 動作 | 世界主人 | 分享者且可共同布置 | 分享者但權限撤銷 | 其他訪客 |
| --- | ---: | ---: | ---: | ---: |
| 看見共享裝飾 | 是 | 是 | 是 | 是 |
| 新增自己的共享裝飾 | 不適用 | 是 | 否 | 否 |
| 移動／旋轉／縮放共享裝飾 | 全部 | 僅自己的 | 否 | 否 |
| 撤回自己的分享 | 不適用 | 是 | 是 | 否 |
| 從目標世界移除 | 全部 | 僅自己的撤回 | 僅自己的撤回 | 否 |
| 授予／撤銷共同布置權 | 是 | 否 | 否 | 否 |
| 取得或出售共享資產 | 否 | 僅原本自己的 inventory 規則 | 僅原本自己的 inventory 規則 | 否 |

每個 RPC 都必須從 `auth.uid()` 解析 actor child profile；禁止接受 requester／actor ID 作為可信參數。世界主人 ID、shared entity ID、inventory item ID 只是目標，不是身份證明。

## 5. 使用者流程與文案

### 5.1 世界主人授權

好友清單中的每位 accepted、unblocked 好友增加「允許一起布置」開關，預設關閉。開啟前顯示：

> 允許這位好友把自己的裝飾放進你的世界，也能調整他分享的裝飾。你可以移動或收起任何好友裝飾。

撤銷時顯示：

> 好友將不能新增或移動裝飾；已經放置的裝飾會保留，你仍可收起。好友仍可撤回自己的分享。

### 5.2 分享者放置

分享者進入已授權好友世界後，顯示「分享裝飾」入口。此入口只列出分享者自己的 decoration inventory，不顯示世界主人的商店、價格或庫存。

流程：選擇自己的裝飾 → 本機放置預覽 → 調整旋轉與縮放 → 確認 → 單次 RPC → 成功後更新快照。未確認與拖曳中不寫 Supabase。

同一來源 inventory item 已在該好友世界展示時，卡片顯示「已分享」，點擊後定位既有展示，不新增第二份。

### 5.3 選取共享裝飾

- 世界主人：顯示「調整位置」「旋轉」「縮放」「從我的世界移除」。
- 分享者且有權限：顯示「調整位置」「旋轉」「縮放」「撤回分享」。
- 分享者但權限撤銷：只顯示「撤回分享」。
- 其他訪客：不顯示選取框與管理控制。

一般世界畫面不永久顯示分享者姓名；來源資訊只在有權管理時的選取面板出現。

### 5.4 離線與重新進入

共同布置權已授予時，分享者可在世界主人離線時放置或調整。世界主人下次進入時讀到最後保存版本。第一版不建立離線通知歷史；若雙方在線，沿用 revision Broadcast 重新載入。

共享裝飾操作不加入 offline queue。網路中斷時保留本機草稿並顯示失敗，恢復連線後由使用者重新確認。

## 6. Supabase 資料模型

不得修改已套用 migration。使用 `npx supabase migration new ...` 建立至少兩個小 migration：schema/permissions 與 mutation/snapshot。若要修改解除好友／封鎖 cleanup，再使用獨立 migration。

### 6.1 `child_world_decoration_collaborators`

建議欄位：

```text
world_owner_child_profile_id uuid not null
collaborator_child_profile_id uuid not null
can_collaborate boolean not null default true
created_at timestamptz not null
updated_at timestamptz not null
primary key (world_owner_child_profile_id, collaborator_child_profile_id)
check world_owner <> collaborator
```

兩端皆 FK `child_profiles(id) on delete cascade`。表啟用 RLS，但 revoke authenticated direct insert/update/delete；正常操作只能經 security-definer RPC。若需要 select，也只允許安全 RPC 投影，不開放 broad table read。

權限列不是好友關係替代品。每次授權與每次 mutation 都重新確認 accepted friendship 且雙向未封鎖。

### 6.2 `child_shared_world_decorations`

建議欄位：

```text
id uuid primary key default gen_random_uuid()
world_owner_child_profile_id uuid not null
source_child_profile_id uuid not null
source_inventory_item_id uuid not null
world_layout_version smallint not null default 1
position_x / position_y / position_z numeric not null
rotation_x / rotation_y / rotation_z numeric not null
scale numeric not null
is_active boolean not null default true
removed_reason text null
created_at timestamptz not null
updated_at timestamptz not null
check world_owner <> source
```

規則：

- `source_inventory_item_id` FK `child_inventory_items(id) on delete cascade`。
- `world_owner_child_profile_id`、`source_child_profile_id` FK `child_profiles(id) on delete cascade`。
- partial unique index：同一 `world_owner_child_profile_id + source_inventory_item_id` 只能有一筆 active 展示。
- index：`(world_owner_child_profile_id, is_active)` 與 `(source_child_profile_id, is_active)`。
- `removed_reason` allowlist 至少為 `owner_removed`、`source_withdrew`、`friendship_removed`、`blocked`、`source_unavailable`；active row 必須為 null。
- 加入狀態一致性 check：`is_active=true` 時 `removed_reason is null`，`is_active=false` 時 `removed_reason is not null`。
- 不重複儲存 `asset_key`、價格、thumbnail 或 catalog metadata；快照由 inventory join catalog 取得 canonical `asset_key`。
- 不建立 quantity、gift recipient、points、wallet 或 resale 欄位。

### 6.3 數量限制

第一版固定：

- 每位分享者在同一好友世界最多 10 件 active 共享裝飾。
- 每個世界最多 50 件 active 共享裝飾。
- 同一來源 inventory item 在同一目標世界最多 1 件 active 展示。
- 好友世界安全快照仍維持最多 250 個總實體；若原生實體加共享實體超過上限，RPC 必須以穩定順序截斷並記錄可測試的優先級，不能依無排序 query 隨機缺件。

建議快照優先原生 owner entities，再依 shared decoration `created_at, id` 取共享展示。UI 在接近 50 件時顯示剩餘額度。

## 7. RPC 契約

RPC 名稱可以依現有命名微調，但責任不得合併成一個接受任意 JSON 的萬用 RPC。每個函式使用固定 `search_path = pg_catalog, public, private`、明確參數、transaction、最小 grant、generic error，不回傳家庭或庫存資料。

### 7.1 `set_friend_world_decoration_collaboration`

輸入：`target_friend_child_profile_id`, `enabled`。

- actor 必須是目前登入小孩，也是目標世界主人。
- target 必須為 accepted、unblocked friend。
- upsert permission row。
- permission 是 world snapshot 的 capability 一部分；更新後增加世界主人 revision 一次，讓目前在線的好友透過既有 revision hint 重新取得按鈕權限。不得另發一個 permission Broadcast。
- 相同 `enabled` 重複提交必須 idempotent：不更新 timestamp、不增加 revision、不發通知。
- 不允許 target 代替 owner 授權自己。
- 為避免額外 permission 查詢，最新版 `list_my_friends` 安全投影應一併回傳「這位好友是否可布置我的世界」，好友世界 snapshot top-level 則回傳「目前 viewer 是否可在目標世界分享裝飾」。兩者都由 server 計算，不接受 client 自報。

### 7.2 `place_shared_world_decoration`

輸入：`target_world_owner_child_profile_id`, `source_inventory_item_id`, `expected_revision`, transform。

- actor 必須等於 source inventory owner。
- target 必須授權 actor `can_collaborate=true`，且仍為 accepted、unblocked friend。
- inventory quantity 必須大於 0；catalog 必須是 active decoration。Client 分享清單只提供本機 asset registry 支援的項目；server 不信任 client allowlist，只信任 canonical inventory/catalog。舊版 client 缺少某個本機模型時必須安全忽略該展示，不可 crash。
- 驗證 10/50 件上限與 active unique constraint。
- 沿用 canonical `private.validate_world_transform` 的世界邊界、中央樹、出生點、scale 與 collision 規則；不得在 shared RPC 重寫另一套常數。
- lock 目標 owner 的 `child_world_states`，檢查 `expected_revision`。
- insert shared row，目標 owner revision 只增加一次，回傳安全 entity projection 與新 revision。

### 7.3 `update_shared_world_decoration_transform`

輸入：`target_world_owner_child_profile_id`, `shared_entity_id`, `expected_revision`, transform。

- actor 若為世界主人，可更新任何 active shared decoration。
- actor 若為 source，必須仍有 `can_collaborate=true`，只能更新自己的 row。
- 其他人一律拒絕。
- 驗證 catalog、inventory、transform 與 world revision；更新成功只增加目標 owner revision 一次。
- 不接受 `source_child_profile_id` 或 `asset_key` 作為可修改欄位。

### 7.4 `remove_shared_world_decoration`

輸入：`target_world_owner_child_profile_id`, `shared_entity_id`, `expected_revision`。

- 世界主人可移除任何 active shared row，reason=`owner_removed`。
- source 可撤回自己的 active row，reason=`source_withdrew`，不受 `can_collaborate` 限制。
- 其他人拒絕。
- 使用 soft inactive，增加目標 owner revision 一次。
- 不更新或刪除 source inventory。

### 7.5 `collect_shared_world_decorations`

輸入：`target_world_owner_child_profile_id`, `expected_revision`。

- 只有世界主人可執行。
- 將該世界全部 active shared rows 設 inactive，reason=`owner_removed`。
- 不觸碰 source inventory。
- 整批只增加一次 revision。

### 7.6 解除好友與封鎖 cleanup

更新現有 remove/block RPC 的最新版定義，不修改舊 migration：

- 同一 transaction 停用 A 分享到 B 與 B 分享到 A 的 active shared rows。
- `removed_reason` 依操作為 `friendship_removed` 或 `blocked`。
- 每個實際受影響的世界 revision 各增加一次，不按裝飾件數增加。
- 刪除雙方對應的 permission rows。重加好友後必須由世界主人重新授權，不得恢復舊權限。
- 即使 cleanup 因舊資料漏執行，所有 snapshot 與 mutation RPC 仍須重新檢查 friendship/block，fail closed。

### 7.7 帳號刪除與來源失效

不能只依賴 `source_inventory_item_id on delete cascade`，否則 shared row 雖然消失，仍在線的目標世界可能沒有 revision 通知。執行 AI 必須檢查現有 account-deletion RPC／service，並在刪除 child profile 或 inventory 前：

- 找出該小孩作為 source 的所有 active shared rows。
- 依 `world_owner_child_profile_id` 分組設 inactive，reason=`source_unavailable`。
- 每個實際受影響且仍存在的目標世界 revision 各增加一次。
- 再進行既有帳號刪除流程。

若來源 catalog item 在版本更新中被設為 inactive，snapshot 必須立即 fail closed 不再投影；這種發布期變更不需要為每個世界逐筆寫 revision，但 App 更新／重新載入後不得繼續顯示失效資產。

## 8. 快照與隱私投影

擴充最新版 `get_friend_world_snapshot`，不得建立第二份完整好友世界查詢。

top-level 新增 `can_share_decorations`，表示目前 requester 是否為目標世界主人授權且關係仍為 accepted/unblocked。Client 不另外輪詢 permission table。

`entities` 合併：

- 目標 owner 的 active `child_world_entities`。
- 目標 world 的 active `child_shared_world_decorations`，且 source inventory quantity > 0、catalog active、item type decoration、source 與 owner 仍為 accepted/unblocked friends。

每個 entity 新增安全欄位：

```text
placement_scope: owned | shared
can_transform: boolean
can_remove: boolean
shared_by_me: boolean
shared_source_display_name: text | null
```

`shared_source_display_name` 只有 requester 是世界主人或該 shared row source 時才回傳；對其他訪客必須為 null。不要回傳 source profile ID、inventory item ID、family ID、quantity、價格或購買紀錄。

更新 `FriendWorldSnapshotEntity` normalization，對缺少新欄位的舊 payload 使用安全預設：`placementScope='owned'`, `canTransform=false`, `canRemove=false`, `sharedByMe=false`。錯誤型別仍 fail closed。

同步更新 `FriendSummary`／好友 repository normalization，讀取 server 投影的 `can_collaborate_in_my_world`。缺少欄位時預設 false，避免舊 server 被 client 誤解為已授權。

## 9. Client 與模組邊界

不要把功能直接堆進 `ChildDashboard.tsx`、`WorldSocialLayer.tsx`、`TerrainWorldLayer.tsx` 或 `prototype-world-runtime.ts`。新 domain 建議放在：

```text
src/features/shared-decorations/
  contracts.ts
  permissions.ts
  shared-decoration-game-data.ts
  shared-decoration-errors.ts
  hooks/use-shared-decorations.ts
  components/SharedDecorationPermissionControl.tsx
  components/SharedDecorationInventorySheet.tsx
  components/SharedDecorationActions.tsx

src/lib/social-data/
  shared-decoration-repository.ts
```

責任：

- repository：只負責 RPC 呼叫與資料 normalization。
- hook/service：載入、optimistic draft、revision conflict recovery 與 mutation lifecycle。
- permission pure module：根據 server flags 決定按鈕，不自行推導好友身份。
- game-data adapter：只為 3D scene 建立 shared decoration 的 synthetic scene inventory/catalog reference；不得把 synthetic inventory 寫入 `state.gameDataByChildId` 或顯示成世界主人擁有。
- UI components：授權、分享清單與動作；大檔只接 adapter/callback。
- world runtime：繼續使用 canonical asset registry、ground offset、collision metadata 與 disposal；共享來源不建立另一套 GLB loader。

`WorldSocialLayer` 可持有目前世界的 shared decoration snapshot/session，但新增行數應由 extraction 抵銷或保持在治理 baseline。自己世界載入時可呼叫既有 snapshot RPC 取得 safe shared projection，再只合併 `placement_scope='shared'`；參觀好友世界沿用已存在的同一次 snapshot，不額外查詢。

選取 shared decoration 時必須攜帶 `placementScope` 與 server capability flags，mutation route 才能選擇 shared RPC。不得靠 synthetic inventory ID prefix 作唯一授權判斷；prefix 只可用於本機 key 穩定性。

## 10. Supabase 用量預算

| 使用情境 | Database | Realtime |
| --- | --- | --- |
| 進入自己世界 | 最多 1 次 safe snapshot RPC 取得共享裝飾 | 訂閱既有 world topic |
| 進入好友世界 | 沿用既有 1 次 friend snapshot RPC | 沿用既有 private topic |
| 拖曳／旋轉／縮放中 | 0 write、0 RPC | 0 裝飾事件 |
| 放開並確認 | 1 次 typed RPC、1 次 revision increment | 既有 trigger 發 1 組 revision hint |
| 收起全部好友裝飾 | 1 次 RPC、1 次 revision increment | 既有 revision hint |
| 世界無人在線 | 不輪詢 | 無 Presence/Broadcast 消耗 |

不得：

- 每個 pointer move 寫 Supabase。
- 為 shared decoration 新增 position Broadcast。
- 輪詢世界快照。
- 在 Supabase Storage 複製 GLB 或 thumbnail。
- 每件 shared decoration 分別查 inventory/catalog，造成 N+1；快照必須一次 join/aggregate。
- client mutation 後手動再 Broadcast 一次 revision；資料庫 trigger 已是 canonical 通知來源。

client 可在單次 mutation 進行期間禁用重複提交，但 client debounce 不是安全邊界。資料庫數量上限、權限、revision、unique index 與 transform validation 必須全部在 server 執行。

目前既有 world mutation RPC 沒有本功能專屬的 durable rate-bucket。第一版不新增逐次 mutation log 或計數資料表，避免每次正常放置再增加一筆額外 write；以 authenticated child、accepted friendship、owner grant、10/50 件上限、單次 in-flight UI gate 與 optimistic revision 限制正常與併發流量。這不代表惡意 client 已被完整 rate-limit：遠端發布前的 security review 必須確認 Supabase 專案層是否已有適用的 API/RPC rate limit。若沒有且 threat model 要求 server-side rate limit，必須另開獨立 migration/infra 變更，不可把只存在 client 的 debounce 宣稱為安全控制。

## 11. 錯誤與競態

使用可轉譯、但不洩露私人狀態的錯誤類型：

| 情況 | 使用者文案 |
| --- | --- |
| 沒有共同布置權／已解除好友／被封鎖 | 目前無法在這個好友世界共同布置。 |
| revision conflict | 世界剛被好友更新，已重新載入，請再確認位置。 |
| source inventory 不存在或 quantity=0 | 這件裝飾目前無法分享。 |
| 已分享同一件 | 這件裝飾已經在好友世界中。 |
| 超過分享者上限 | 你在這個世界最多可分享 10 件裝飾。 |
| 超過世界上限 | 這個世界的好友裝飾已達上限。 |
| transform 無效 | 這個位置無法放置裝飾。 |

Repository 不向 UI 傳 SQLERRM、constraint name、profile ID 或 Supabase raw error。預期 conflict 不自動無限重試；重新抓一次快照，保留草稿，交由使用者再次確認。

## 12. 實作階段

### Phase 0：基線與 characterization

1. 記錄 branch、HEAD、`git status --short --branch`，辨識現有未提交變更。
2. 跑現有 friend snapshot、visit permission、world mutation、collision 與 multiplayer revision tests。
3. 新增 failing contract tests，先固定本計畫的產品規則與權限矩陣。
4. 不啟動 dev server，不修改 CSS，不碰資產。

停止條件：現有基線測試失敗且與共享裝飾無關時，記錄並停止，不可順手修復。

### Phase 1：schema 與 SQL security contract

1. 建立 collaborator 與 shared decoration schema migration。
2. 加 RLS、revoke/grant、FK、check、partial unique 與索引。
3. 新增 SQL contract/RLS tests，涵蓋 anon、非好友、pending、removed、blocked、偽造 actor。
4. 不修改遠端 Supabase。

### Phase 2：typed mutation RPC 與 snapshot

1. 實作授權、place、update、remove、collect RPC。
2. 共用或抽取 canonical transform validation，不複製常數。
3. 擴充 friend snapshot union、top-level capability 與安全權限投影。
4. 擴充最新版 `list_my_friends`，投影 owner 對每位好友的共同布置權，不新增逐好友查詢。
5. 加 revision/transaction/concurrency tests。
6. 更新 remove friendship/block RPC cleanup，以獨立 migration 完成。

### Phase 3：client contracts、repository 與 session

1. 新增 shared decoration contracts/normalization/repository。
2. 新增 hook/service，所有 mutation 使用 expected revision。
3. 擴充 world social session，自己世界與好友世界都能取得 shared projection。
4. revision Broadcast 只觸發一次 reload；相同或舊 revision 忽略。

### Phase 4：只讀渲染與碰撞

1. 先讓 host、source、第三訪客都能正確看見 shared decoration。
2. 驗證本機 registry 缺 asset 時安全忽略/顯示既有 fallback，不崩潰。
3. 共享裝飾沿用 ground offset、scale、shadow、光源效果、草地遮罩與 navigation collision。
4. 先不開啟任何編輯按鈕，完成 scene contract 後再進 Phase 5。

### Phase 5：權限 UI 與共同編輯

1. 好友清單加入 owner-only「允許一起布置」。
2. 已授權訪客加入「分享裝飾」清單，只讀自己的 inventory。
3. selection actions 依 server capability flags 顯示。
4. 拖曳本機化，放開後一次提交；conflict reload + 保留草稿。
5. 加「收起全部好友裝飾」，不得誤刪原生裝飾。

如需 CSS，先依 `CSS_RULES.md` 找到 selector owner，禁止追加全域 override。

### Phase 6：生命週期、完整驗證與文件

1. 驗證 permission revoke、unfriend、block、account deletion、catalog inactive、inventory unavailable；account deletion 必須讓每個受影響目標世界 revision 各增加一次。
2. 更新 `docs/friend-world-realtime-plan.md` 的「訪客不能修改」規則，改為「除經世界主人授權的共享裝飾外，訪客仍不可修改世界資料」。
3. 更新 `docs/game-assets.md`，說明 shared placement 沿用同一 asset registry 與 metadata，不是新資產類型。
4. 執行完整品質命令並記錄 exit code。

## 13. 必要測試

建議新增：

```text
tests/shared-decoration-contracts.test.ts
tests/shared-decoration-database-contract.test.ts
tests/shared-decoration-rls.test.ts
tests/shared-decoration-snapshot.test.ts
tests/shared-decoration-permissions.test.ts
tests/shared-decoration-scene.test.ts
tests/shared-decoration-ui.test.ts
tests/shared-decoration-lifecycle.test.ts
```

最低測試案例：

- owner 授權 accepted/unblocked friend 成功；好友不能自授權。
- permission toggle 只增加目標世界 revision 一次；`list_my_friends` 與 snapshot capability 隨 revision reload 更新，缺欄位預設 false。
- pending、removed、declined、blocked、非好友、anon 全部失敗。
- source 擁有 decoration quantity > 0 才能分享；pet/character/inactive catalog 失敗。
- source 原生世界 entity 與 inventory 在分享、移動、撤回後完全不變。
- host 可移動/移除所有 shared；source 只能移動/撤回自己的；第三訪客不能修改。
- permission revoke 後既有 row 保留、source transform update 失敗、source withdraw 成功。
- unfriend/block 雙向 shared rows inactive，兩個受影響世界各只增加一次 revision。
- 相同 source inventory 在同一 target world 不能 active 重複，在不同好友世界可以。
- 10/50/250 上限與穩定排序正確。
- invalid scale、NaN/Infinity、越界、中央樹與出生點保護沿用 canonical validation。
- stale expected revision 回 conflict，不部分寫入。
- snapshot 不洩露 family、inventory ID、quantity、points、source profile ID；第三訪客拿不到 source display name。
- 一次 mutation 只增加一次目標世界 revision；不增加 source 自己世界 revision。
- drag/pointer move 不呼叫 repository；drop confirm 恰好一次。
- reload 與 duplicate `world_revision_v1` 不造成無限 snapshot loop。
- collect shared 不停用 owner 原生 decoration；若新增統一 collect RPC，必須 transactional 且 revision +1。

## 14. 驗證命令

每一 phase 先跑 targeted tests，最後執行：

```bash
npm run lint
npm run quality:structure
npm test
npm run build
npm run security:check
git diff --check
```

本計畫不授權自動執行 `npm run cap:sync`、開啟 Xcode、部署 Supabase migration、push 或啟動 dev server。需要 browser/device/3D visual 驗證時，先取得使用者明確授權；沒有 visual evidence 時必須標記「自動測試通過，視覺尚未驗證」。

## 15. 驗收情境

1. 小華在好友列表授權小明一起布置；小明在線時透過既有 revision reload 立即取得分享入口。
2. 小明離線/在線皆可進入小華世界，從自己的 inventory 分享一張沙發。
3. 小明自己的沙發與庫存保持原樣；小華世界重新載入後仍有共享沙發。
4. 小華移動沙發後，小明重新載入看到新位置。
5. 小明有權限時可移動；小華撤銷權限後，小明不能移動但可以撤回。
6. 小華可移除展示，且小明庫存完全不變。
7. 第三位好友可看見沙發，但不知道分享者身份，也不能選取管理。
8. 雙方同時修改造成 revision conflict 時，不覆蓋對方已提交結果。
9. 解除好友或封鎖後，雙方放在彼此世界的共享展示停止顯示。
10. 沒有人操作時不輪詢；拖曳中沒有 database write 或 decoration Broadcast。

上述十項、必要測試與完整品質命令全部通過，且沒有未解釋的資料洩漏、權限繞過或既有世界行為回歸，才可標記功能完成。

## 16. 非目標與禁止事項

- 不共享寵物、人物、點數、任務、商店價格或聊天內容。
- 不建立玩家上傳 GLB/圖片功能。
- 不建立公開共同世界、房間碼或非好友協作。
- 不讓其他共同布置者移動彼此的共享裝飾。
- 不把 shared row 偽裝成世界主人的 inventory ownership。
- 不寫每幀位置、不輪詢、不建立持久編輯鎖。
- 不修改現有寵物 runtime、GLB、FBX、catalog 或 pet tests。
- 不重寫已套用 migration；只新增 migration。
- 不以 client 顯示/隱藏按鈕取代 server authorization。
- 不在這個功能內順手重構大型 dashboard/runtime 或改造全部好友系統。

## 17. 回退策略

- 每一 phase 使用獨立、可 `git revert <commit>` 的 commit；schema、RPC、client read、UI write 分開。
- UI 可用本機 feature flag 暫時隱藏，但 server authorization 不能只靠 flag。
- 回退 UI/mutation client 時，shared rows可留在資料庫但不應由舊 client crash；snapshot normalization 對新欄位保持向後相容。
- migration 已部署後不得刪 history。需要停用時新增 migration revoke mutation RPC grants、停用入口，保留資料供後續恢復或受控清理。
- 任何回退都不得刪除分享者 inventory item 或改變原生 `child_world_entities`。
