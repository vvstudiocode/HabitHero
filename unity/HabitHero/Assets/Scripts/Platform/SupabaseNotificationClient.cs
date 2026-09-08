using System;
using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    [Serializable]
    public sealed class SupabaseNotificationPreferenceRecord
    {
        public bool notifications_enabled;
    }

    public sealed class SupabaseNotificationClient
    {
        private readonly SupabaseRestClient restClient;

        public SupabaseNotificationClient(SupabaseRestClient restClient)
        {
            if (restClient == null) throw new ArgumentNullException("restClient");
            this.restClient = restClient;
        }

        public async Task<bool> LoadPreferenceAsync(
            string profileId,
            CancellationToken cancellationToken)
        {
            RequireProfileId(profileId);
            SupabaseNotificationPreferenceRecord record =
                await restClient.SelectSingleAsync<SupabaseNotificationPreferenceRecord>(
                    "profiles",
                    new[] { new SupabaseRestFilter("id", "eq", profileId) },
                    "notifications_enabled",
                    cancellationToken);
            return record == null || record.notifications_enabled;
        }

        public async Task SetPreferenceAsync(
            string profileId,
            bool enabled,
            CancellationToken cancellationToken)
        {
            RequireProfileId(profileId);
            await restClient.UpdateAsync(
                "profiles",
                new[] { new SupabaseRestFilter("id", "eq", profileId) },
                "{\"notifications_enabled\":"
                    + (enabled ? "true" : "false")
                    + "}",
                cancellationToken);
            if (!enabled)
            {
                await DisableDevicesAsync(profileId, cancellationToken);
            }
        }

        public Task DisableDevicesAsync(
            string profileId,
            CancellationToken cancellationToken)
        {
            RequireProfileId(profileId);
            return restClient.UpdateAsync(
                "push_devices",
                new[] { new SupabaseRestFilter("profile_id", "eq", profileId) },
                "{\"enabled\":false}",
                cancellationToken);
        }

        public Task RegisterDeviceAsync(
            string familyId,
            string profileId,
            string childProfileId,
            string platform,
            string token,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(familyId))
            {
                throw new SupabaseDataException("家庭 ID 不可為空。");
            }
            RequireProfileId(profileId);
            if (string.IsNullOrWhiteSpace(platform)
                || !IsSupportedPlatform(platform.Trim().ToLowerInvariant()))
            {
                throw new SupabaseDataException("通知平台不受支援。");
            }
            if (string.IsNullOrWhiteSpace(token)
                || token.Trim().Length < 20
                || token.Trim().Length > 4096)
            {
                throw new SupabaseDataException("Push token 長度無效。");
            }

            string body = "{\"family_id\":" + SupabaseJson.Quote(familyId)
                + ",\"profile_id\":" + SupabaseJson.Quote(profileId)
                + ",\"child_profile_id\":" + SupabaseJson.NullableString(childProfileId)
                + ",\"platform\":" + SupabaseJson.Quote(platform.Trim().ToLowerInvariant())
                + ",\"token\":" + SupabaseJson.Quote(token.Trim())
                + ",\"enabled\":true}";
            return restClient.UpsertAsync(
                "push_devices",
                body,
                "profile_id,token",
                cancellationToken);
        }

        private static void RequireProfileId(string profileId)
        {
            if (string.IsNullOrWhiteSpace(profileId))
            {
                throw new SupabaseDataException("使用者 ID 不可為空。");
            }
        }

        private static bool IsSupportedPlatform(string platform)
        {
            return platform == "ios" || platform == "android" || platform == "web";
        }
    }
}
