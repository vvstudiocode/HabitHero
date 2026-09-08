using System;
using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    [Serializable]
    public sealed class SupabaseFriendWorldEntityRecord
    {
        public string id;
        public string entity_kind;
        public string asset_key;
        public float position_x;
        public float position_y;
        public float position_z;
        public float rotation_x;
        public float rotation_y;
        public float rotation_z;
        public float scale;
        public string behavior_mode;
        public string display_name;
    }

    [Serializable]
    public sealed class SupabaseChildFriendWorldData
    {
        public string worldOwnerChildProfileId;
        public string displayName;
        public string characterAssetKey;
        public long revision;
        public SupabaseFriendWorldEntityRecord[] entities;
    }

    [Serializable]
    internal sealed class SupabaseFriendWorldSnapshotResponse
    {
        public string world_owner_child_profile_id;
        public string display_name;
        public string character_asset_key;
        public long revision;
        public SupabaseFriendWorldEntityRecord[] entities;
    }

    public sealed class SupabaseChildFriendWorldClient
    {
        private readonly SupabaseRestClient restClient;

        public SupabaseChildFriendWorldClient(SupabaseRestClient restClient)
        {
            if (restClient == null) throw new ArgumentNullException("restClient");
            this.restClient = restClient;
        }

        public async Task<SupabaseChildFriendWorldData> LoadAsync(
            string targetChildProfileId,
            CancellationToken cancellationToken)
        {
            RequireTarget(targetChildProfileId);
            string response = await restClient.CallRpcAsync(
                "get_friend_world_snapshot",
                "{\"target_child_profile_id\":"
                    + SupabaseJson.Quote(targetChildProfileId.Trim())
                    + "}",
                cancellationToken);

            SupabaseFriendWorldSnapshotResponse responseData;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out responseData,
                    out error))
            {
                throw new SupabaseDataException(error);
            }

            if (responseData == null
                || string.IsNullOrWhiteSpace(responseData.world_owner_child_profile_id)
                || !string.Equals(
                    responseData.world_owner_child_profile_id,
                    targetChildProfileId.Trim(),
                    StringComparison.OrdinalIgnoreCase))
            {
                throw new SupabaseDataException(
                    "好友世界回傳的擁有者資料無效。",
                    200);
            }

            return new SupabaseChildFriendWorldData
            {
                worldOwnerChildProfileId = responseData.world_owner_child_profile_id,
                displayName = responseData.display_name ?? string.Empty,
                characterAssetKey = responseData.character_asset_key ?? string.Empty,
                revision = responseData.revision,
                entities = responseData.entities ?? new SupabaseFriendWorldEntityRecord[0],
            };
        }

        private static void RequireTarget(string targetChildProfileId)
        {
            if (string.IsNullOrWhiteSpace(targetChildProfileId)
                || ContainsControlCharacter(targetChildProfileId))
            {
                throw new ArgumentException(
                    "好友世界目標無效。",
                    "targetChildProfileId");
            }
        }

        private static bool ContainsControlCharacter(string value)
        {
            foreach (char character in value)
            {
                if (character < 32 || character == 127) return true;
            }

            return false;
        }
    }
}
