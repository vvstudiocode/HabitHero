using System;
using System.Globalization;
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
        public string placement_scope;
        public bool can_transform;
        public bool can_remove;
        public bool shared_by_me;
        public string shared_source_display_name;
    }

    [Serializable]
    public sealed class SupabaseChildFriendWorldData
    {
        public string worldOwnerChildProfileId;
        public string displayName;
        public string characterAssetKey;
        public long revision;
        public bool canShareDecorations;
        public SupabaseFriendWorldEntityRecord[] entities;
    }

    [Serializable]
    public sealed class SupabaseFriendWorldTransform
    {
        public float x;
        public float y;
        public float z;
        public float rotationX;
        public float rotationY;
        public float rotationZ;
        public float scale;
    }

    [Serializable]
    public sealed class SupabaseFriendWorldMutationResult
    {
        public long revision;
        public SupabaseFriendWorldEntityRecord entity;
    }

    [Serializable]
    internal sealed class SupabaseFriendWorldSnapshotResponse
    {
        public string world_owner_child_profile_id;
        public string display_name;
        public string character_asset_key;
        public long revision;
        public bool can_share_decorations;
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
                canShareDecorations = responseData.can_share_decorations,
                entities = responseData.entities ?? new SupabaseFriendWorldEntityRecord[0],
            };
        }

        public async Task SetDecorationCollaborationAsync(
            string targetWorldOwnerChildProfileId,
            string collaboratorChildProfileId,
            bool canCollaborate,
            CancellationToken cancellationToken)
        {
            RequireTarget(targetWorldOwnerChildProfileId);
            RequireValue(collaboratorChildProfileId, "好友資料");
            string body = "{\"target_world_owner_child_profile_id\":"
                + SupabaseJson.Quote(targetWorldOwnerChildProfileId.Trim())
                + ",\"target_collaborator_child_profile_id\":"
                + SupabaseJson.Quote(collaboratorChildProfileId.Trim())
                + ",\"target_can_collaborate\":"
                + canCollaborate.ToString().ToLowerInvariant()
                + "}";
            await restClient.CallRpcAsync(
                "set_friend_world_decoration_collaboration",
                body,
                cancellationToken);
        }

        public Task<SupabaseFriendWorldMutationResult> PlaceSharedDecorationAsync(
            string targetWorldOwnerChildProfileId,
            string sourceInventoryItemId,
            long expectedRevision,
            SupabaseFriendWorldTransform transform,
            CancellationToken cancellationToken)
        {
            return CallDecorationMutationAsync(
                "place_shared_world_decoration",
                targetWorldOwnerChildProfileId,
                "source_inventory_item_id",
                sourceInventoryItemId,
                expectedRevision,
                transform,
                cancellationToken);
        }

        public Task<SupabaseFriendWorldMutationResult> UpdateSharedDecorationTransformAsync(
            string targetWorldOwnerChildProfileId,
            string sharedEntityId,
            long expectedRevision,
            SupabaseFriendWorldTransform transform,
            CancellationToken cancellationToken)
        {
            return CallDecorationMutationAsync(
                "update_shared_world_decoration_transform",
                targetWorldOwnerChildProfileId,
                "shared_entity_id",
                sharedEntityId,
                expectedRevision,
                transform,
                cancellationToken);
        }

        public Task<SupabaseFriendWorldMutationResult> RemoveSharedDecorationAsync(
            string targetWorldOwnerChildProfileId,
            string sharedEntityId,
            long expectedRevision,
            CancellationToken cancellationToken)
        {
            RequireTarget(targetWorldOwnerChildProfileId);
            RequireValue(sharedEntityId, "共享裝飾");
            RequireRevision(expectedRevision);
            string body = "{\"target_world_owner_child_profile_id\":"
                + SupabaseJson.Quote(targetWorldOwnerChildProfileId.Trim())
                + ",\"shared_entity_id\":"
                + SupabaseJson.Quote(sharedEntityId.Trim())
                + ",\"expected_revision\":"
                + expectedRevision.ToString(CultureInfo.InvariantCulture)
                + "}";
            return CallMutationRpcAsync(
                "remove_shared_world_decoration",
                body,
                cancellationToken);
        }

        public Task<SupabaseFriendWorldMutationResult> CollectSharedDecorationsAsync(
            string targetWorldOwnerChildProfileId,
            long expectedRevision,
            CancellationToken cancellationToken)
        {
            RequireTarget(targetWorldOwnerChildProfileId);
            RequireRevision(expectedRevision);
            string body = "{\"target_world_owner_child_profile_id\":"
                + SupabaseJson.Quote(targetWorldOwnerChildProfileId.Trim())
                + ",\"expected_revision\":"
                + expectedRevision.ToString(CultureInfo.InvariantCulture)
                + "}";
            return CallMutationRpcAsync(
                "collect_shared_world_decorations",
                body,
                cancellationToken);
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

        private async Task<SupabaseFriendWorldMutationResult> CallDecorationMutationAsync(
            string functionName,
            string targetWorldOwnerChildProfileId,
            string targetParameterName,
            string targetValue,
            long expectedRevision,
            SupabaseFriendWorldTransform transform,
            CancellationToken cancellationToken)
        {
            RequireTarget(targetWorldOwnerChildProfileId);
            RequireValue(targetValue, "共享裝飾");
            RequireRevision(expectedRevision);
            ValidateTransform(transform);
            string body = "{\"target_world_owner_child_profile_id\":"
                + SupabaseJson.Quote(targetWorldOwnerChildProfileId.Trim())
                + ",\""
                + targetParameterName
                + "\":"
                + SupabaseJson.Quote(targetValue.Trim())
                + ",\"expected_revision\":"
                + expectedRevision.ToString(CultureInfo.InvariantCulture)
                + BuildTransformJson(transform)
                + "}";
            return await CallMutationRpcAsync(
                functionName,
                body,
                cancellationToken);
        }

        private async Task<SupabaseFriendWorldMutationResult> CallMutationRpcAsync(
            string functionName,
            string body,
            CancellationToken cancellationToken)
        {
            string response = await restClient.CallRpcAsync(
                functionName,
                body,
                cancellationToken);
            SupabaseFriendWorldMutationResult result;
            string error;
            if (!SupabaseJsonObjectParser.TryParseObject(
                    response,
                    out result,
                    out error))
            {
                throw new SupabaseDataException("共享裝飾結果無法解析：" + error);
            }

            return result;
        }

        private static string BuildTransformJson(SupabaseFriendWorldTransform transform)
        {
            return ",\"position_x\":" + FormatNumber(transform.x)
                + ",\"position_y\":" + FormatNumber(transform.y)
                + ",\"position_z\":" + FormatNumber(transform.z)
                + ",\"rotation_x\":" + FormatNumber(transform.rotationX)
                + ",\"rotation_y\":" + FormatNumber(transform.rotationY)
                + ",\"rotation_z\":" + FormatNumber(transform.rotationZ)
                + ",\"scale\":" + FormatNumber(transform.scale);
        }

        private static string FormatNumber(float value)
        {
            return value.ToString("R", CultureInfo.InvariantCulture);
        }

        private static void RequireRevision(long revision)
        {
            if (revision < 0) throw new ArgumentOutOfRangeException("expectedRevision");
        }

        private static void ValidateTransform(SupabaseFriendWorldTransform transform)
        {
            if (transform == null
                || float.IsNaN(transform.x)
                || float.IsInfinity(transform.x)
                || float.IsNaN(transform.y)
                || float.IsInfinity(transform.y)
                || float.IsNaN(transform.z)
                || float.IsInfinity(transform.z)
                || float.IsNaN(transform.rotationX)
                || float.IsInfinity(transform.rotationX)
                || float.IsNaN(transform.rotationY)
                || float.IsInfinity(transform.rotationY)
                || float.IsNaN(transform.rotationZ)
                || float.IsInfinity(transform.rotationZ)
                || float.IsNaN(transform.scale)
                || float.IsInfinity(transform.scale))
            {
                throw new ArgumentException("共享裝飾座標無效。", "transform");
            }
        }

        private static void RequireValue(string value, string label)
        {
            if (string.IsNullOrWhiteSpace(value) || ContainsControlCharacter(value))
            {
                throw new ArgumentException(label + "無效。", "value");
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
