using System;
using System.Collections.Generic;
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

            await Task.WhenAll(catalog, prices, wallets, inventory, loadouts);

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
            };
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
