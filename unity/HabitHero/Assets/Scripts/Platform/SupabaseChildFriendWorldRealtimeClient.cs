using System;
using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    public sealed class SupabaseChildFriendWorldRealtimeClient
    {
        private readonly SupabaseRestClient restClient;
        private readonly Func<ISupabaseRealtimeTransport> transportFactory;

        public SupabaseChildFriendWorldRealtimeClient(
            SupabaseRestClient restClient,
            Func<ISupabaseRealtimeTransport> transportFactory = null)
        {
            if (restClient == null) throw new ArgumentNullException("restClient");
            this.restClient = restClient;
            this.transportFactory = transportFactory;
        }

        public static string GetLiveTopic(string worldOwnerChildProfileId)
        {
            RequireValue(worldOwnerChildProfileId, "worldOwnerChildProfileId");
            return "friend-world-live:" + worldOwnerChildProfileId.Trim();
        }

        public static string BuildPresencePayload(
            string connectionId,
            string childProfileId,
            string joinedAt)
        {
            RequireValue(connectionId, "connectionId");
            RequireValue(childProfileId, "childProfileId");
            RequireValue(joinedAt, "joinedAt");
            return "{\"connectionId\":" + SupabaseJson.Quote(connectionId.Trim())
                + ",\"childProfileId\":" + SupabaseJson.Quote(childProfileId.Trim())
                + ",\"joinedAt\":" + SupabaseJson.Quote(joinedAt.Trim()) + "}";
        }

        public async Task<SupabaseChildFriendWorldRealtimeSubscription> SubscribeAsync(
            string worldOwnerChildProfileId,
            string connectionId,
            string childProfileId,
            Action<SupabaseFriendWorldPresenceMember[]> onPresence,
            Action<SupabaseFriendWorldAvatarState> onAvatarState,
            Action onAvatarStateRequest,
            Action onWorldRevision,
            CancellationToken cancellationToken,
            Action<bool> onCapacityChanged = null)
        {
            RequireValue(worldOwnerChildProfileId, "worldOwnerChildProfileId");
            RequireValue(connectionId, "connectionId");
            RequireValue(childProfileId, "childProfileId");
            CancellationTokenSource lifetimeCancellation =
                CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            SupabaseRealtimeChannel channel = restClient.CreateRealtimeChannel(transportFactory);
            SupabaseChildFriendWorldRealtimeSubscription subscription =
                new SupabaseChildFriendWorldRealtimeSubscription(
                    channel,
                    worldOwnerChildProfileId.Trim(),
                    connectionId.Trim(),
                    childProfileId.Trim(),
                    lifetimeCancellation,
                    onPresence,
                    onAvatarState,
                    onAvatarStateRequest,
                    onWorldRevision,
                    onCapacityChanged);
            SupabaseRealtimeChannelOptions options = new SupabaseRealtimeChannelOptions
            {
                Private = true,
                PresenceEnabled = true,
                PresenceKey = connectionId.Trim(),
                BroadcastSelf = false,
                BroadcastAck = false,
            };

            try
            {
                await channel.ConnectAsync(
                    GetLiveTopic(worldOwnerChildProfileId),
                    options,
                    lifetimeCancellation.Token);
                await subscription.TrackInitialAsync(lifetimeCancellation.Token);
                return subscription;
            }
            catch
            {
                subscription.Dispose();
                throw;
            }
        }

        private static void RequireValue(string value, string parameterName)
        {
            if (string.IsNullOrWhiteSpace(value) || ContainsControlCharacter(value))
            {
                throw new ArgumentException(
                    "Friend world realtime " + parameterName + " is invalid.",
                    parameterName);
            }
        }

        private static bool ContainsControlCharacter(string value)
        {
            foreach (char character in value)
                if (character < 32 || character == 127) return true;
            return false;
        }
    }
}
