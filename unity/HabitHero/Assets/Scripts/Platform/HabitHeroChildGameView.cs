using System;
using System.Threading.Tasks;
using HabitHero.Platform;
using UnityEngine;
using UnityEngine.UI;

namespace HabitHero.App
{
    public sealed class HabitHeroChildGameView
    {
        private readonly Transform canvasTransform;
        private readonly Font font;
        private GameObject gamePanel;
        private Text gameStatus;
        private SupabaseChildGameData latestData;
        private SupabaseChildWorldData latestWorldData;
        private Func<string, int, string, Task<SupabaseChildGameData>> purchaseGameItem;
        private Func<string, Task<SupabaseChildGameData>> equipGameCharacter;
        private Func<string, string, Task<SupabaseChildGameData>> setPetDisplayName;
        private Func<string[], Task<SupabaseChildGameData>> setFollowingPets;
        private Func<string[], Task<SupabaseChildGameData>> setRoamingPets;
        private Func<string, long, SupabaseFriendWorldTransform, string, int?, Task<SupabaseChildGameData>> placeWorldEntity;
        private Func<string, string, long, SupabaseFriendWorldTransform, Task<SupabaseChildGameData>> updateWorldEntity;
        private Func<string, string, long, Task<SupabaseChildGameData>> removeWorldEntity;
        private Func<long, Task<SupabaseChildGameData>> collectWorldDecorations;

        public HabitHeroChildGameView(Transform canvasTransform, Font font)
        {
            if (canvasTransform == null) throw new ArgumentNullException("canvasTransform");
            if (font == null) throw new ArgumentNullException("font");
            this.canvasTransform = canvasTransform;
            this.font = font;
        }

        public void Show(
            SupabaseChildGameData data,
            SupabaseChildWorldData worldData,
            Func<string, int, string, Task<SupabaseChildGameData>> purchaseGameItem,
            Func<string, Task<SupabaseChildGameData>> equipGameCharacter,
            Func<string, string, Task<SupabaseChildGameData>> setPetDisplayName,
            Func<string[], Task<SupabaseChildGameData>> setFollowingPets,
            Func<string[], Task<SupabaseChildGameData>> setRoamingPets,
            Func<string, long, SupabaseFriendWorldTransform, string, int?, Task<SupabaseChildGameData>> placeWorldEntity,
            Func<string, string, long, SupabaseFriendWorldTransform, Task<SupabaseChildGameData>> updateWorldEntity,
            Func<string, string, long, Task<SupabaseChildGameData>> removeWorldEntity,
            Func<long, Task<SupabaseChildGameData>> collectWorldDecorations)
        {
            Close();
            latestData = data;
            latestWorldData = worldData;
            this.purchaseGameItem = purchaseGameItem;
            this.equipGameCharacter = equipGameCharacter;
            this.setPetDisplayName = setPetDisplayName;
            this.setFollowingPets = setFollowingPets;
            this.setRoamingPets = setRoamingPets;
            this.placeWorldEntity = placeWorldEntity;
            this.updateWorldEntity = updateWorldEntity;
            this.removeWorldEntity = removeWorldEntity;
            this.collectWorldDecorations = collectWorldDecorations;
        }

        public void ApplyData(SupabaseChildGameData data)
        {
            latestData = data;
            if (gamePanel == null) return;
            Close();
            Open();
        }

        public void ApplyWorldData(SupabaseChildWorldData data)
        {
            latestWorldData = data;
            if (gamePanel == null) return;
            Close();
            Open();
        }

        public void Open()
        {
            if (latestData == null)
            {
                return;
            }

            Close();
            gamePanel = HabitHeroUiFactory.CreatePanel(
                canvasTransform,
                new Color(0.02f, 0.035f, 0.06f, 0.9f),
                "ChildGamePanel");
            GameObject card = HabitHeroUiFactory.CreatePanel(
                gamePanel.transform,
                HabitHeroUiFactory.PanelColor,
                "ChildGameCard");
            RectTransform cardRect = card.GetComponent<RectTransform>();
            cardRect.anchorMin = new Vector2(0.06f, 0.08f);
            cardRect.anchorMax = new Vector2(0.94f, 0.92f);
            cardRect.offsetMin = Vector2.zero;
            cardRect.offsetMax = Vector2.zero;

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "冒險商店與背包",
                32,
                TextAnchor.MiddleCenter,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.89f),
                new Vector2(0.92f, 0.97f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "任務捲餘額：" + latestData.walletBalance,
                19,
                TextAnchor.MiddleCenter,
                Color.white,
                new Vector2(0.08f, 0.82f),
                new Vector2(0.92f, 0.89f));
            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "可購買商品",
                18,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.74f),
                new Vector2(0.92f, 0.81f));
            GameObject catalogList = CreateList(
                card.transform,
                "CatalogList",
                new Vector2(0.08f, 0.49f),
                new Vector2(0.92f, 0.74f));
            RenderCatalog(catalogList.transform);

            HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "我的背包",
                18,
                TextAnchor.MiddleLeft,
                HabitHeroUiFactory.AccentColor,
                new Vector2(0.08f, 0.42f),
                new Vector2(0.42f, 0.49f));
            Button clearFollowing = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "清空跟隨",
                new Vector2(0.44f, 0.42f),
                new Vector2(0.59f, 0.49f));
            clearFollowing.onClick.AddListener(() => SetFollowingPetsAsync(
                new string[0],
                clearFollowing));
            Button clearRoaming = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "清空巡遊",
                new Vector2(0.61f, 0.42f),
                new Vector2(0.76f, 0.49f));
            clearRoaming.onClick.AddListener(() => SetRoamingPetsAsync(
                new string[0],
                clearRoaming));
            Button collectDecorations = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "收納裝飾",
                new Vector2(0.78f, 0.42f),
                new Vector2(0.92f, 0.49f));
            collectDecorations.interactable = collectWorldDecorations != null;
            collectDecorations.onClick.AddListener(() => CollectWorldDecorationsAsync(
                collectDecorations));
            GameObject inventoryList = CreateList(
                card.transform,
                "InventoryList",
                new Vector2(0.08f, 0.13f),
                new Vector2(0.92f, 0.42f));
            RenderInventory(inventoryList.transform);

            gameStatus = HabitHeroUiFactory.CreateText(
                card.transform,
                font,
                "購買與配置會由 Supabase 伺服器驗證。",
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                new Vector2(0.08f, 0.08f),
                new Vector2(0.92f, 0.13f));
            Button closeButton = HabitHeroUiFactory.CreateButton(
                card.transform,
                font,
                "關閉",
                new Vector2(0.35f, 0.015f),
                new Vector2(0.65f, 0.075f));
            closeButton.onClick.AddListener(Close);
        }

        public void Dispose()
        {
            Close();
            latestData = null;
            latestWorldData = null;
            purchaseGameItem = null;
            equipGameCharacter = null;
            setPetDisplayName = null;
            setFollowingPets = null;
            setRoamingPets = null;
            placeWorldEntity = null;
            updateWorldEntity = null;
            removeWorldEntity = null;
            collectWorldDecorations = null;
        }

        private void RenderCatalog(Transform parent)
        {
            int visibleCount = 0;
            foreach (SupabaseGameCatalogItemRecord item in latestData.catalog ?? new SupabaseGameCatalogItemRecord[0])
            {
                if (item == null || !item.is_active || item.is_starter || !item.is_newly_obtainable)
                {
                    continue;
                }

                SupabaseGamePurchaseGate gate = GetPurchaseGate(item);
                if (!gate.visible) continue;

                GameObject row = CreateRow(parent, "CatalogRow");
                string sourceText = string.IsNullOrWhiteSpace(gate.source_label)
                    ? string.Empty
                    : "　來源：" + gate.source_label;
                string gateText = gate.purchasable
                    ? string.Empty
                    : "　（" + GetGateLabel(gate.reason) + "）";
                Text label = HabitHeroUiFactory.CreateText(
                    row.transform,
                    font,
                    item.name + "　" + GetPrice(item) + " 捲" + sourceText + gateText,
                    16,
                    TextAnchor.MiddleLeft,
                    Color.white,
                    Vector2.zero,
                    Vector2.one);
                AddFlexibleLayout(label.gameObject);
                Button buyButton = CreateRowButton(
                    row.transform,
                    gate.purchasable ? "購買" : GetGateLabel(gate.reason));
                buyButton.interactable = gate.purchasable;
                if (gate.purchasable)
                {
                    buyButton.onClick.AddListener(() => PurchaseGameAsync(item, gate, buyButton));
                }
                visibleCount += 1;
                if (visibleCount >= 6) break;
            }

            if (visibleCount == 0)
            {
                CreateEmptyRow(parent, "目前沒有可購買的冒險商品。");
            }
        }

        private void RenderInventory(Transform parent)
        {
            int visibleCount = 0;
            foreach (SupabaseChildInventoryItemRecord inventory in latestData.inventory ?? new SupabaseChildInventoryItemRecord[0])
            {
                if (inventory == null) continue;
                SupabaseGameCatalogItemRecord item = FindCatalogItem(inventory.catalog_item_id);
                string itemName = item == null ? inventory.catalog_item_id : item.name;
                GameObject row = CreateRow(parent, "InventoryRow");
                Text label = HabitHeroUiFactory.CreateText(
                    row.transform,
                    font,
                    itemName + " ×" + inventory.quantity,
                    15,
                    TextAnchor.MiddleLeft,
                    Color.white,
                    Vector2.zero,
                    Vector2.one);
                AddFlexibleLayout(label.gameObject);

                if (item != null && item.item_type == "character")
                {
                    Button equipButton = CreateRowButton(row.transform, "裝備");
                    equipButton.onClick.AddListener(() => EquipGameCharacterAsync(
                        inventory.id,
                        equipButton));
                }
                else if (item != null && item.item_type == "pet")
                {
                    InputField nameInput = CreateRowInput(
                        row.transform,
                        string.IsNullOrWhiteSpace(inventory.display_name)
                            ? itemName
                            : inventory.display_name,
                        inventory.display_name);
                    Button renameButton = CreateRowButton(row.transform, "命名");
                    renameButton.interactable = setPetDisplayName != null;
                    renameButton.onClick.AddListener(() => SetPetDisplayNameAsync(
                        inventory.id,
                        nameInput,
                        renameButton));
                    Button followButton = CreateRowButton(row.transform, IsFollowing(inventory.id) ? "取消跟隨" : "跟隨");
                    followButton.onClick.AddListener(() => SetFollowingPetsAsync(
                        IsFollowing(inventory.id) ? new string[0] : new[] { inventory.id },
                        followButton));
                    Button roamButton = CreateRowButton(row.transform, "巡遊");
                    roamButton.onClick.AddListener(() => SetRoamingPetsAsync(
                        new[] { inventory.id },
                        roamButton));
                }
                else if (item != null && item.item_type == "decoration")
                {
                    SupabaseChildWorldEntityRecord entity = FindActiveWorldEntity(inventory.id);
                    int activeEntityCount = CountActiveWorldEntities(inventory.id);
                    if (inventory.quantity > activeEntityCount)
                    {
                        Button placeButton = CreateRowButton(row.transform, "放置");
                        placeButton.interactable = placeWorldEntity != null;
                        placeButton.onClick.AddListener(() => PlaceWorldEntityAsync(
                            inventory.id,
                            item,
                            placeButton));
                    }
                    if (entity != null)
                    {
                        Button moveButton = CreateRowButton(row.transform, "右移");
                        moveButton.interactable = updateWorldEntity != null;
                        moveButton.onClick.AddListener(() => MoveWorldEntityAsync(
                            inventory.id,
                            entity,
                            moveButton));
                        Button removeButton = CreateRowButton(row.transform, "收回");
                        removeButton.interactable = removeWorldEntity != null;
                        removeButton.onClick.AddListener(() => RemoveWorldEntityAsync(
                            inventory.id,
                            entity,
                            removeButton));
                    }
                }

                visibleCount += 1;
                if (visibleCount >= 8) break;
            }

            if (visibleCount == 0)
            {
                CreateEmptyRow(parent, "完成任務後，就能把冒險商品放進背包。");
            }
        }

        private async void PurchaseGameAsync(
            SupabaseGameCatalogItemRecord item,
            SupabaseGamePurchaseGate gate,
            Button button)
        {
            if (item == null || gate == null || !gate.purchasable || purchaseGameItem == null) return;
            if (button != null) button.interactable = false;
            string sourceText = string.IsNullOrWhiteSpace(gate.source_label)
                ? string.Empty
                : "（" + gate.source_label + "）";
            SetGameStatus("正在購買「" + item.name + "」" + sourceText + "…", false);
            try
            {
                SupabaseChildGameData refreshed = await purchaseGameItem(
                    item.id,
                    1,
                    gate.source_npc_id);
                ApplyData(refreshed);
                SetGameStatus("已購買「" + item.name + "」。", false);
            }
            catch (Exception exception)
            {
                SetGameStatus("購買失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void EquipGameCharacterAsync(string inventoryItemId, Button button)
        {
            if (equipGameCharacter == null) return;
            if (button != null) button.interactable = false;
            SetGameStatus("正在套用角色…", false);
            try
            {
                await ApplyMutationAsync(equipGameCharacter(inventoryItemId));
                SetGameStatus("角色已套用。", false);
            }
            catch (Exception exception)
            {
                SetGameStatus("角色套用失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void SetFollowingPetsAsync(string[] inventoryItemIds, Button button)
        {
            if (setFollowingPets == null) return;
            if (button != null) button.interactable = false;
            SetGameStatus("正在更新跟隨寵物…", false);
            try
            {
                await ApplyMutationAsync(setFollowingPets(inventoryItemIds));
                SetGameStatus("跟隨寵物已更新。", false);
            }
            catch (Exception exception)
            {
                SetGameStatus("跟隨寵物更新失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void SetPetDisplayNameAsync(
            string inventoryItemId,
            InputField nameInput,
            Button button)
        {
            if (setPetDisplayName == null) return;
            if (button != null) button.interactable = false;
            string displayName = nameInput == null ? string.Empty : nameInput.text.Trim();
            if (displayName.Length > 12)
            {
                SetGameStatus("寵物名字最多 12 個字。", true);
                if (button != null) button.interactable = true;
                return;
            }

            SetGameStatus(
                displayName.Length == 0 ? "正在恢復寵物預設名稱…" : "正在更新寵物名字…",
                false);
            try
            {
                SupabaseChildGameData refreshed = await setPetDisplayName(
                    inventoryItemId,
                    displayName.Length == 0 ? null : displayName);
                if (refreshed == null)
                {
                    throw new SupabaseDataException("伺服器沒有回傳最新遊戲資料。");
                }
                ApplyData(refreshed);
                SetGameStatus(
                    displayName.Length == 0 ? "已恢復寵物預設名稱。" : "寵物名字已更新。",
                    false);
            }
            catch (Exception exception)
            {
                SetGameStatus("寵物命名失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void SetRoamingPetsAsync(string[] inventoryItemIds, Button button)
        {
            if (setRoamingPets == null) return;
            if (button != null) button.interactable = false;
            SetGameStatus("正在更新巡遊寵物…", false);
            try
            {
                await ApplyMutationAsync(setRoamingPets(inventoryItemIds));
                SetGameStatus("巡遊寵物已更新。", false);
            }
            catch (Exception exception)
            {
                SetGameStatus("巡遊寵物更新失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void PlaceWorldEntityAsync(
            string inventoryItemId,
            SupabaseGameCatalogItemRecord item,
            Button button)
        {
            if (placeWorldEntity == null || item == null) return;
            if (button != null) button.interactable = false;
            SetGameStatus("正在把裝飾放入我的世界…", false);
            try
            {
                SupabaseChildGameData refreshed = await placeWorldEntity(
                    inventoryItemId,
                    latestData.worldRevision,
                    CreateDefaultWorldTransform(item),
                    "static",
                    null);
                if (refreshed == null)
                {
                    throw new SupabaseDataException("伺服器沒有回傳最新遊戲資料。");
                }

                ApplyData(refreshed);
                SetGameStatus("裝飾已放入我的世界。", false);
            }
            catch (Exception exception)
            {
                SetGameStatus("裝飾放置失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void MoveWorldEntityAsync(
            string inventoryItemId,
            SupabaseChildWorldEntityRecord entity,
            Button button)
        {
            if (updateWorldEntity == null || entity == null) return;
            if (button != null) button.interactable = false;
            SetGameStatus("正在更新裝飾位置…", false);
            try
            {
                SupabaseFriendWorldTransform transform = CreateTransform(entity);
                transform.x = Mathf.Clamp(transform.x + 0.8f, -13f, 13f);
                SupabaseChildGameData refreshed = await updateWorldEntity(
                    inventoryItemId,
                    entity.id,
                    latestData.worldRevision,
                    transform);
                if (refreshed == null)
                {
                    throw new SupabaseDataException("伺服器沒有回傳最新遊戲資料。");
                }

                ApplyData(refreshed);
                SetGameStatus("裝飾位置已更新。", false);
            }
            catch (Exception exception)
            {
                SetGameStatus("裝飾移動失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void RemoveWorldEntityAsync(
            string inventoryItemId,
            SupabaseChildWorldEntityRecord entity,
            Button button)
        {
            if (removeWorldEntity == null || entity == null) return;
            if (button != null) button.interactable = false;
            SetGameStatus("正在把裝飾收回背包…", false);
            try
            {
                SupabaseChildGameData refreshed = await removeWorldEntity(
                    inventoryItemId,
                    entity.id,
                    latestData.worldRevision);
                if (refreshed == null)
                {
                    throw new SupabaseDataException("伺服器沒有回傳最新遊戲資料。");
                }

                ApplyData(refreshed);
                SetGameStatus("裝飾已收回背包。", false);
            }
            catch (Exception exception)
            {
                SetGameStatus("裝飾收回失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async void CollectWorldDecorationsAsync(Button button)
        {
            if (collectWorldDecorations == null) return;
            if (button != null) button.interactable = false;
            SetGameStatus("正在收納我的世界裝飾…", false);
            try
            {
                SupabaseChildGameData refreshed = await collectWorldDecorations(
                    latestData.worldRevision);
                if (refreshed == null)
                {
                    throw new SupabaseDataException("伺服器沒有回傳最新遊戲資料。");
                }

                ApplyData(refreshed);
                SetGameStatus("所有自有裝飾已收回背包。", false);
            }
            catch (Exception exception)
            {
                SetGameStatus("裝飾收納失敗：" + exception.Message, true);
                if (button != null) button.interactable = true;
            }
        }

        private async Task ApplyMutationAsync(Task<SupabaseChildGameData> mutation)
        {
            SupabaseChildGameData refreshed = await mutation;
            if (refreshed == null) throw new SupabaseDataException("伺服器沒有回傳最新遊戲資料。");
            ApplyData(refreshed);
        }

        private SupabaseChildWorldEntityRecord FindActiveWorldEntity(
            string inventoryItemId)
        {
            foreach (SupabaseChildWorldEntityRecord entity in
                latestData.worldEntities ?? new SupabaseChildWorldEntityRecord[0])
            {
                if (entity != null
                    && entity.is_active
                    && entity.inventory_item_id == inventoryItemId)
                {
                    return entity;
                }
            }

            return null;
        }

        private int CountActiveWorldEntities(string inventoryItemId)
        {
            int count = 0;
            foreach (SupabaseChildWorldEntityRecord entity in
                latestData.worldEntities ?? new SupabaseChildWorldEntityRecord[0])
            {
                if (entity != null
                    && entity.is_active
                    && entity.entity_kind == "decoration"
                    && entity.inventory_item_id == inventoryItemId)
                {
                    count += 1;
                }
            }

            return count;
        }

        private SupabaseFriendWorldTransform CreateDefaultWorldTransform(
            SupabaseGameCatalogItemRecord item)
        {
            int placedCount = 0;
            foreach (SupabaseChildWorldEntityRecord entity in
                latestData.worldEntities ?? new SupabaseChildWorldEntityRecord[0])
            {
                if (entity != null && entity.is_active && entity.entity_kind == "decoration")
                {
                    placedCount += 1;
                }
            }

            int column = placedCount % 3;
            int row = placedCount / 3;
            float minScale = item.min_scale > 0f ? item.min_scale : 0.75f;
            float maxScale = item.max_scale >= minScale ? item.max_scale : minScale;
            return new SupabaseFriendWorldTransform
            {
                x = -4.5f + column * 2.8f,
                y = 0f,
                z = -5.5f + row * 2.8f,
                rotationX = 0f,
                rotationY = 0f,
                rotationZ = 0f,
                scale = Mathf.Clamp(1f, minScale, maxScale),
            };
        }

        private static SupabaseFriendWorldTransform CreateTransform(
            SupabaseChildWorldEntityRecord entity)
        {
            return new SupabaseFriendWorldTransform
            {
                x = entity.position_x,
                y = entity.position_y,
                z = entity.position_z,
                rotationX = entity.rotation_x,
                rotationY = entity.rotation_y,
                rotationZ = entity.rotation_z,
                scale = entity.scale <= 0f ? 1f : entity.scale,
            };
        }

        private int GetPrice(SupabaseGameCatalogItemRecord item)
        {
            foreach (SupabaseGamePriceRecord price in latestData.prices ?? new SupabaseGamePriceRecord[0])
            {
                if (price != null && price.catalog_item_id == item.id) return price.scroll_price;
            }

            return item.scroll_price;
        }

        private bool IsFollowing(string inventoryItemId)
        {
            if (latestData.loadout == null) return false;
            foreach (string selectedId in latestData.loadout.following_pet_inventory_ids ?? new string[0])
            {
                if (selectedId == inventoryItemId) return true;
            }

            return latestData.loadout.following_pet_inventory_id == inventoryItemId;
        }

        private SupabaseGameCatalogItemRecord FindCatalogItem(string catalogItemId)
        {
            foreach (SupabaseGameCatalogItemRecord item in latestData.catalog ?? new SupabaseGameCatalogItemRecord[0])
            {
                if (item != null && item.id == catalogItemId) return item;
            }

            return null;
        }

        private SupabaseGamePurchaseGate GetPurchaseGate(SupabaseGameCatalogItemRecord item)
        {
            if (latestWorldData == null)
            {
                return new SupabaseGamePurchaseGate
                {
                    visible = true,
                    purchasable = false,
                    reason = "world_data_unavailable",
                };
            }

            return latestWorldData.GetPurchaseGate(item.id, item.item_type);
        }

        private static string GetGateLabel(string reason)
        {
            switch (reason)
            {
                case "scene_locked":
                    return "解鎖場景";
                case "dialogue_required":
                    return "先找 NPC";
                case "world_data_unavailable":
                    return "等待同步";
                default:
                    return "暫不可購買";
            }
        }

        private GameObject CreateList(
            Transform parent,
            string name,
            Vector2 anchorMin,
            Vector2 anchorMax)
        {
            GameObject list = new GameObject(
                name,
                typeof(RectTransform),
                typeof(VerticalLayoutGroup));
            list.transform.SetParent(parent, false);
            RectTransform rect = list.GetComponent<RectTransform>();
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
            VerticalLayoutGroup layout = list.GetComponent<VerticalLayoutGroup>();
            layout.spacing = 5f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            return list;
        }

        private GameObject CreateRow(Transform parent, string name)
        {
            GameObject row = new GameObject(
                name,
                typeof(RectTransform),
                typeof(HorizontalLayoutGroup));
            row.transform.SetParent(parent, false);
            row.GetComponent<RectTransform>().sizeDelta = new Vector2(0f, 37f);
            HorizontalLayoutGroup layout = row.GetComponent<HorizontalLayoutGroup>();
            layout.spacing = 5f;
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = false;
            layout.childForceExpandHeight = true;
            return row;
        }

        private Button CreateRowButton(Transform parent, string label)
        {
            Button button = HabitHeroUiFactory.CreateButton(
                parent,
                font,
                label,
                Vector2.zero,
                Vector2.one);
            LayoutElement layout = button.gameObject.AddComponent<LayoutElement>();
            layout.preferredWidth = 82f;
            layout.minWidth = 82f;
            return button;
        }

        private InputField CreateRowInput(
            Transform parent,
            string placeholder,
            string value)
        {
            InputField input = HabitHeroUiFactory.CreateInput(
                parent,
                font,
                placeholder,
                false,
                Vector2.zero,
                Vector2.one);
            input.contentType = InputField.ContentType.Standard;
            input.lineType = InputField.LineType.SingleLine;
            input.characterLimit = 12;
            input.text = value ?? string.Empty;
            LayoutElement layout = input.gameObject.AddComponent<LayoutElement>();
            layout.preferredWidth = 150f;
            layout.minWidth = 110f;
            return input;
        }

        private static void AddFlexibleLayout(GameObject target)
        {
            LayoutElement layout = target.AddComponent<LayoutElement>();
            layout.flexibleWidth = 1f;
        }

        private void CreateEmptyRow(Transform parent, string message)
        {
            GameObject row = CreateRow(parent, "EmptyRow");
            Text text = HabitHeroUiFactory.CreateText(
                row.transform,
                font,
                message,
                15,
                TextAnchor.MiddleCenter,
                new Color(0.84f, 0.89f, 0.96f, 1f),
                Vector2.zero,
                Vector2.one);
            AddFlexibleLayout(text.gameObject);
        }

        private void SetGameStatus(string message, bool isError)
        {
            if (gameStatus == null) return;
            gameStatus.text = message;
            gameStatus.color = isError
                ? new Color(1f, 0.52f, 0.52f, 1f)
                : new Color(0.84f, 0.89f, 0.96f, 1f);
        }

        public void Close()
        {
            if (gamePanel != null)
            {
                UnityEngine.Object.Destroy(gamePanel);
                gamePanel = null;
            }

            gameStatus = null;
        }
    }
}
