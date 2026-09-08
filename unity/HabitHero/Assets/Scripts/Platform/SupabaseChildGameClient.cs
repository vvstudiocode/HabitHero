using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    [Serializable]
    public sealed class SupabaseGameCatalogItemRecord
    {
        public string id;
        public string item_type;
        public string name;
        public string description;
        public int scroll_price;
        public string asset_key;
        public string thumbnail_url;
        public bool is_active;
        public bool is_starter;
        public bool is_child_creation_selectable;
        public bool is_newly_obtainable;
        public bool is_stackable;
        public float collision_radius;
        public float min_scale;
        public float max_scale;
        public int sort_order;
    }

    [Serializable]
    public sealed class SupabaseGamePriceRecord
    {
        public string catalog_item_id;
        public int scroll_price;
    }

    [Serializable]
    public sealed class SupabaseChildGameWalletRecord
    {
        public string child_profile_id;
        public string family_id;
        public long scroll_balance;
    }

    [Serializable]
    public sealed class SupabaseChildInventoryItemRecord
    {
        public string id;
        public string family_id;
        public string child_profile_id;
        public string catalog_item_id;
        public long quantity;
        public string acquired_via;
        public string acquired_at;
        public string display_name;
        public string source_scene_id;
        public string source_npc_id;
        public int source_dialogue_version;
    }

    [Serializable]
    public sealed class SupabaseChildWorldStateRecord
    {
        public string family_id;
        public string child_profile_id;
        public long revision;
    }

    [Serializable]
    public sealed class SupabaseChildWorldEntityRecord
    {
        public string id;
        public string family_id;
        public string child_profile_id;
        public string inventory_item_id;
        public string entity_kind;
        public float position_x;
        public float position_y;
        public float position_z;
        public float rotation_x;
        public float rotation_y;
        public float rotation_z;
        public float scale;
        public string behavior_mode;
        public int roaming_slot;
        public int world_layout_version;
        public bool is_active;
    }

    [Serializable]
    public sealed class SupabaseChildSharedWorldDecorationRecord
    {
        public string id;
        public string source_inventory_item_id;
        public string catalog_item_id;
        public string asset_key;
        public float position_x;
        public float position_y;
        public float position_z;
        public float rotation_x;
        public float rotation_y;
        public float rotation_z;
        public float scale;
        public string behavior_mode;
        public bool is_active;
        public bool shared_by_me;
        public string shared_source_display_name;
    }

    [Serializable]
    public sealed class SupabaseChildGameLoadoutRecord
    {
        public string child_profile_id;
        public string family_id;
        public string equipped_character_inventory_id;
        public string following_pet_inventory_id;
        public string[] following_pet_inventory_ids;
    }

    [Serializable]
    public sealed class SupabaseGamePurchaseResult
    {
        public string purchase_id;
        public string inventory_item_id;
        public long wallet_balance;
        public long quantity;
        public string source_scene_id;
        public string source_npc_id;
        public int source_dialogue_version;
    }

    [Serializable]
    public sealed class SupabaseGameMutationResult
    {
        public long revision;
        public SupabaseChildWorldEntityRecord entity;
    }

    public sealed class SupabaseChildGameData
    {
        public string familyId;
        public string childProfileId;
        public SupabaseGameCatalogItemRecord[] catalog;
        public SupabaseGamePriceRecord[] prices;
        public long walletBalance;
        public SupabaseChildInventoryItemRecord[] inventory;
        public SupabaseChildGameLoadoutRecord loadout;
        public long worldRevision;
        public SupabaseChildWorldEntityRecord[] worldEntities;
        public SupabaseChildSharedWorldDecorationRecord[] sharedWorldDecorations;
    }

    public sealed class SupabaseChildGameClient
    {
        private readonly SupabaseRestClient restClient;

        public SupabaseChildGameClient(SupabaseRestClient restClient)
        {
            if (restClient == null) throw new ArgumentNullException("restClient");
            this.restClient = restClient;
        }

        public async Task<SupabaseChildGameData> LoadAsync(
            string familyId,
            string childProfileId,
            CancellationToken cancellationToken)
        {
            RequireScope(familyId, childProfileId);

            SupabaseRestFilter[] childFilters =
            {
                new SupabaseRestFilter("family_id", "eq", familyId),
                new SupabaseRestFilter("child_profile_id", "eq", childProfileId),
            };
            Task<SupabaseGameCatalogItemRecord[]> catalog = restClient.SelectManyAsync<SupabaseGameCatalogItemRecord>(
                "game_catalog_items",
                null,
                "*",
                "sort_order.asc",
                0,
                cancellationToken);
            Task<SupabaseGamePriceRecord[]> prices = restClient.SelectManyAsync<SupabaseGamePriceRecord>(
                "family_game_item_prices",
                new[] { new SupabaseRestFilter("family_id", "eq", familyId) },
                "catalog_item_id,scroll_price",
                null,
                0,
                cancellationToken);
            Task<SupabaseChildGameWalletRecord[]> wallets = restClient.SelectManyAsync<SupabaseChildGameWalletRecord>(
                "child_game_wallets",
                childFilters,
                "*",
                null,
                0,
                cancellationToken);
            Task<SupabaseChildInventoryItemRecord[]> inventory = restClient.SelectManyAsync<SupabaseChildInventoryItemRecord>(
                "child_inventory_items",
                childFilters,
                "*",
                "acquired_at.asc",
                0,
                cancellationToken);
            Task<SupabaseChildGameLoadoutRecord[]> loadouts = restClient.SelectManyAsync<SupabaseChildGameLoadoutRecord>(
                "child_game_loadouts",
                childFilters,
                "*",
                null,
                0,
                cancellationToken);
            Task<SupabaseChildWorldStateRecord[]> worldStates = restClient.SelectManyAsync<SupabaseChildWorldStateRecord>(
                "child_world_states",
                childFilters,
                "*",
                null,
                0,
                cancellationToken);
            Task<SupabaseChildWorldEntityRecord[]> worldEntities = restClient.SelectManyAsync<SupabaseChildWorldEntityRecord>(
                "child_world_entities",
                childFilters,
                "*",
                "updated_at.asc",
                0,
                cancellationToken);
            Task<SupabaseChildSharedWorldDecorationRecord[]> sharedWorldDecorations =
                LoadSharedWorldDecorationsAsync(childProfileId, cancellationToken);

            await Task.WhenAll(
                catalog,
                prices,
                wallets,
                inventory,
                loadouts,
                worldStates,
                worldEntities,
                sharedWorldDecorations);

            SupabaseChildGameLoadoutRecord loadout = loadouts.Result.Length == 0
                ? null
                : loadouts.Result[0];
            NormalizeLoadout(loadout);
            return new SupabaseChildGameData
            {
                familyId = familyId,
                childProfileId = childProfileId,
                catalog = catalog.Result ?? new SupabaseGameCatalogItemRecord[0],
                prices = prices.Result ?? new SupabaseGamePriceRecord[0],
                walletBalance = wallets.Result.Length == 0 ? 0 : wallets.Result[0].scroll_balance,
                inventory = inventory.Result ?? new SupabaseChildInventoryItemRecord[0],
                loadout = loadout,
                worldRevision = worldStates.Result.Length == 0 ? 0 : worldStates.Result[0].revision,
                worldEntities = worldEntities.Result ?? new SupabaseChildWorldEntityRecord[0],
                sharedWorldDecorations = sharedWorldDecorations.Result
                    ?? new SupabaseChildSharedWorldDecorationRecord[0],
            };
        }

        private async Task<SupabaseChildSharedWorldDecorationRecord[]> LoadSharedWorldDecorationsAsync(
            string childProfileId,
            CancellationToken cancellationToken)
        {
            string response;
            try
            {
                response = await restClient.CallRpcAsync(
                    "get_my_shared_world_decorations",
                    "{\"target_child_profile_id\":"
                        + SupabaseJson.Quote(childProfileId)
                        + "}",
                    cancellationToken);
            }
            catch (SupabaseDataException exception) when (exception.StatusCode == 404)
            {
                return new SupabaseChildSharedWorldDecorationRecord[0];
            }

            SupabaseChildSharedWorldDecorationRecord[] rows;
            string error;
            if (!SupabaseJsonArrayParser.TryParseArray(
                    response,
                    out rows,
                    out error))
            {
                throw new SupabaseDataException("共享世界裝飾無法解析：" + error);
            }

            return rows ?? new SupabaseChildSharedWorldDecorationRecord[0];
        }

        public Task<SupabaseGameMutationResult> PlaceWorldEntityAsync(
            string childProfileId,
            string inventoryItemId,
            long expectedRevision,
            SupabaseFriendWorldTransform transform,
            string behaviorMode,
            int? roamingSlot,
            CancellationToken cancellationToken)
        {
            RequireValue(childProfileId, "孩子資料");
            RequireValue(inventoryItemId, "世界物件");
            RequireRevision(expectedRevision);
            ValidateTransform(transform);
            RequireBehaviorMode(behaviorMode);
            ValidateRoamingSlot(behaviorMode, roamingSlot);
            string body = BuildTransformBody(
                "target_inventory_item_id",
                inventoryItemId,
                expectedRevision,
                transform)
                + ",\"target_behavior_mode\":"
                + SupabaseJson.Quote(behaviorMode)
                + ",\"target_roaming_slot\":"
                + (roamingSlot.HasValue
                    ? roamingSlot.Value.ToString(CultureInfo.InvariantCulture)
                    : "null")
                + ",\"target_child_profile_id\":"
                + SupabaseJson.Quote(childProfileId)
                + "}";
            return CallMutationRpcAsync(
                "place_world_entity",
                body,
                cancellationToken);
        }

        public Task<SupabaseGameMutationResult> UpdateWorldEntityTransformAsync(
            string childProfileId,
            string inventoryItemId,
            string entityId,
            long expectedRevision,
            SupabaseFriendWorldTransform transform,
            CancellationToken cancellationToken)
        {
            RequireValue(childProfileId, "孩子資料");
            RequireValue(inventoryItemId, "世界物件");
            RequireRevision(expectedRevision);
            ValidateTransform(transform);
            string body = BuildTransformBody(
                "target_inventory_item_id",
                inventoryItemId,
                expectedRevision,
                transform);
            if (!string.IsNullOrWhiteSpace(entityId))
            {
                body += ",\"target_entity_id\":" + SupabaseJson.Quote(entityId.Trim());
            }

            body += ",\"target_child_profile_id\":"
                + SupabaseJson.Quote(childProfileId)
                + "}";
            return CallMutationRpcAsync(
                "update_world_entity_transform",
                body,
                cancellationToken);
        }

        public Task<SupabaseGameMutationResult> RemoveWorldEntityAsync(
            string childProfileId,
            string inventoryItemId,
            string entityId,
            long expectedRevision,
            CancellationToken cancellationToken)
        {
            RequireValue(childProfileId, "孩子資料");
            RequireValue(inventoryItemId, "世界物件");
            RequireRevision(expectedRevision);
            string body = "{\"target_inventory_item_id\":"
                + SupabaseJson.Quote(inventoryItemId.Trim())
                + ",\"expected_revision\":"
                + expectedRevision.ToString(CultureInfo.InvariantCulture);
            if (!string.IsNullOrWhiteSpace(entityId))
            {
                body += ",\"target_entity_id\":" + SupabaseJson.Quote(entityId.Trim());
            }

            body += ",\"target_child_profile_id\":"
                + SupabaseJson.Quote(childProfileId.Trim())
                + "}";
            return CallMutationRpcAsync(
                "remove_world_entity",
                body,
                cancellationToken);
        }

        public Task<SupabaseGameMutationResult> CollectAllWorldDecorationsAsync(
            string childProfileId,
            long expectedRevision,
            CancellationToken cancellationToken)
        {
            RequireValue(childProfileId, "孩子資料");
            RequireRevision(expectedRevision);
            string body = "{\"expected_revision\":"
                + expectedRevision.ToString(CultureInfo.InvariantCulture)
                + ",\"target_child_profile_id\":"
                + SupabaseJson.Quote(childProfileId.Trim())
                + "}";
            return CallMutationRpcAsync(
                "collect_all_world_decorations",
                body,
                cancellationToken);
        }

        public async Task<SupabaseGamePurchaseResult> PurchaseGameItemAsync(
            string childProfileId,
            string catalogItemId,
            int quantity,
            string idempotencyKey,
            string sourceNpcId,
            CancellationToken cancellationToken)
        {
            RequireValue(childProfileId, "孩子資料");
            RequireValue(catalogItemId, "商品");
            RequireValue(idempotencyKey, "購買冪等鍵");
            if (quantity <= 0) throw new SupabaseDataException("購買數量必須大於零。");

            string body = "{\"target_catalog_item_id\":" + SupabaseJson.Quote(catalogItemId)
                + ",\"target_quantity\":" + quantity
                + ",\"purchase_idempotency_key\":" + SupabaseJson.Quote(idempotencyKey)
                + ",\"target_child_profile_id\":" + SupabaseJson.Quote(childProfileId)
                + ",\"target_source_npc_id\":" + SupabaseJson.NullableString(sourceNpcId)
                + "}";
            string response = await restClient.CallRpcAsync(
                "purchase_game_item",
                body,
                cancellationToken);
            return ParseObject<SupabaseGamePurchaseResult>(response, "購買結果");
        }

        public async Task<SupabaseChildGameLoadoutRecord> EquipGameCharacterAsync(
            string childProfileId,
            string inventoryItemId,
            CancellationToken cancellationToken)
        {
            RequireValue(childProfileId, "孩子資料");
            RequireValue(inventoryItemId, "角色背包項目");
            string body = "{\"target_inventory_item_id\":" + SupabaseJson.Quote(inventoryItemId)
                + ",\"target_child_profile_id\":" + SupabaseJson.Quote(childProfileId)
                + "}";
            string response = await restClient.CallRpcAsync(
                "equip_game_character",
                body,
                cancellationToken);
            SupabaseChildGameLoadoutRecord loadout = ParseObject<SupabaseChildGameLoadoutRecord>(
                response,
                "角色裝備結果");
            NormalizeLoadout(loadout);
            return loadout;
        }

        public async Task SetPetDisplayNameAsync(
            string childProfileId,
            string inventoryItemId,
            string displayName,
            CancellationToken cancellationToken)
        {
            RequireValue(childProfileId, "孩子資料");
            RequireValue(inventoryItemId, "寵物背包項目");
            string normalizedName = string.IsNullOrWhiteSpace(displayName)
                ? null
                : displayName.Trim();
            if (normalizedName != null && normalizedName.Length > 12)
            {
                throw new SupabaseDataException("寵物名字最多 12 個字。");
            }

            string body = "{\"target_child_profile_id\":"
                + SupabaseJson.Quote(childProfileId.Trim())
                + ",\"target_inventory_item_id\":"
                + SupabaseJson.Quote(inventoryItemId.Trim())
                + ",\"target_display_name\":"
                + SupabaseJson.NullableString(normalizedName)
                + "}";
            await restClient.CallRpcAsync(
                "set_pet_display_name",
                body,
                cancellationToken);
        }

        public async Task SetFamilyGameItemPriceAsync(
            string catalogItemId,
            int scrollPrice,
            CancellationToken cancellationToken)
        {
            RequireValue(catalogItemId, "商品");
            if (scrollPrice < 1)
            {
                throw new SupabaseDataException("商品價格必須大於零。");
            }

            string body = "{\"target_catalog_item_id\":"
                + SupabaseJson.Quote(catalogItemId.Trim())
                + ",\"target_scroll_price\":"
                + scrollPrice.ToString(CultureInfo.InvariantCulture)
                + "}";
            await restClient.CallRpcAsync(
                "set_family_game_item_price",
                body,
                cancellationToken);
        }

        public async Task ResetFamilyGameItemPriceAsync(
            string catalogItemId,
            CancellationToken cancellationToken)
        {
            RequireValue(catalogItemId, "商品");
            await restClient.CallRpcAsync(
                "reset_family_game_item_price",
                "{\"target_catalog_item_id\":"
                    + SupabaseJson.Quote(catalogItemId.Trim())
                    + "}",
                cancellationToken);
        }

        public Task<SupabaseGameMutationResult> SetFollowingPetsAsync(
            string childProfileId,
            string[] inventoryItemIds,
            CancellationToken cancellationToken)
        {
            return SetPetQueueAsync(
                "set_following_pets",
                childProfileId,
                inventoryItemIds,
                cancellationToken);
        }

        public Task<SupabaseGameMutationResult> SetRoamingPetsAsync(
            string childProfileId,
            string[] inventoryItemIds,
            CancellationToken cancellationToken)
        {
            return SetPetQueueAsync(
                "set_roaming_pets",
                childProfileId,
                inventoryItemIds,
                cancellationToken);
        }

        public static string CreatePurchaseIdempotencyKey()
        {
            return Guid.NewGuid().ToString();
        }

        private async Task<SupabaseGameMutationResult> SetPetQueueAsync(
            string functionName,
            string childProfileId,
            string[] inventoryItemIds,
            CancellationToken cancellationToken)
        {
            RequireValue(childProfileId, "孩子資料");
            string[] ids = inventoryItemIds ?? new string[0];
            string body = "{\"target_inventory_item_ids\":" + QuoteStringArray(ids)
                + ",\"target_child_profile_id\":" + SupabaseJson.Quote(childProfileId)
                + "}";
            string response = await restClient.CallRpcAsync(
                functionName,
                body,
                cancellationToken);
            return ParseObject<SupabaseGameMutationResult>(response, "寵物配置結果");
        }

        private async Task<SupabaseGameMutationResult> CallMutationRpcAsync(
            string functionName,
            string body,
            CancellationToken cancellationToken)
        {
            string response = await restClient.CallRpcAsync(
                functionName,
                body,
                cancellationToken);
            return ParseObject<SupabaseGameMutationResult>(response, "世界物件結果");
        }

        private static string BuildTransformBody(
            string inventoryParameterName,
            string inventoryItemId,
            long expectedRevision,
            SupabaseFriendWorldTransform transform)
        {
            return "{\""
                + inventoryParameterName
                + "\":"
                + SupabaseJson.Quote(inventoryItemId.Trim())
                + ",\"expected_revision\":"
                + expectedRevision.ToString(CultureInfo.InvariantCulture)
                + ",\"position_x\":"
                + FormatNumber(transform.x)
                + ",\"position_y\":"
                + FormatNumber(transform.y)
                + ",\"position_z\":"
                + FormatNumber(transform.z)
                + ",\"rotation_x\":"
                + FormatNumber(transform.rotationX)
                + ",\"rotation_y\":"
                + FormatNumber(transform.rotationY)
                + ",\"rotation_z\":"
                + FormatNumber(transform.rotationZ)
                + ",\"target_scale\":"
                + FormatNumber(transform.scale);
        }

        private static string FormatNumber(float value)
        {
            return value.ToString("R", CultureInfo.InvariantCulture);
        }

        private static void ValidateTransform(SupabaseFriendWorldTransform transform)
        {
            if (transform == null
                || !IsFinite(transform.x)
                || !IsFinite(transform.y)
                || !IsFinite(transform.z)
                || !IsFinite(transform.rotationX)
                || !IsFinite(transform.rotationY)
                || !IsFinite(transform.rotationZ)
                || !IsFinite(transform.scale)
                || transform.scale <= 0f)
            {
                throw new SupabaseDataException("世界物件座標無效。");
            }
        }

        private static bool IsFinite(float value)
        {
            return !float.IsNaN(value) && !float.IsInfinity(value);
        }

        private static void RequireRevision(long revision)
        {
            if (revision < 0) throw new SupabaseDataException("世界版本無效。");
        }

        private static void RequireBehaviorMode(string behaviorMode)
        {
            if (behaviorMode != "static"
                && behaviorMode != "idle"
                && behaviorMode != "wander")
            {
                throw new SupabaseDataException("世界物件行為無效。");
            }
        }

        private static void ValidateRoamingSlot(string behaviorMode, int? roamingSlot)
        {
            if (behaviorMode == "wander")
            {
                if (!roamingSlot.HasValue || roamingSlot.Value < 1 || roamingSlot.Value > 3)
                {
                    throw new SupabaseDataException("巡遊位置無效。");
                }

                return;
            }

            if (roamingSlot.HasValue)
            {
                throw new SupabaseDataException("非巡遊物件不可指定巡遊位置。");
            }
        }

        private static string QuoteStringArray(IEnumerable<string> values)
        {
            StringBuilder builder = new StringBuilder("[");
            bool first = true;
            foreach (string value in values)
            {
                RequireValue(value, "背包項目");
                if (!first) builder.Append(',');
                builder.Append(SupabaseJson.Quote(value));
                first = false;
            }

            return builder.Append(']').ToString();
        }

        private static T ParseObject<T>(string response, string label)
        {
            T value;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(response, out value, out error))
            {
                throw new SupabaseDataException(label + "無法解析：" + error);
            }

            return value;
        }

        private static void NormalizeLoadout(SupabaseChildGameLoadoutRecord loadout)
        {
            if (loadout == null) return;
            if (loadout.following_pet_inventory_ids != null) return;
            loadout.following_pet_inventory_ids = string.IsNullOrWhiteSpace(
                loadout.following_pet_inventory_id)
                ? new string[0]
                : new[] { loadout.following_pet_inventory_id };
        }

        private static void RequireScope(string familyId, string childProfileId)
        {
            RequireValue(familyId, "家庭資料");
            RequireValue(childProfileId, "孩子資料");
        }

        private static void RequireValue(string value, string label)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                throw new SupabaseDataException(label + "不可為空白。");
            }
        }
    }
}
