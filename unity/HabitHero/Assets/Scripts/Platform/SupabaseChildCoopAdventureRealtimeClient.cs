using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    public sealed class SupabaseChildCoopAdventureRealtimeClient
    {
        public const string ChangeEvent = "coop_changed_v1";

        private readonly SupabaseRestClient restClient;
        private readonly Func<ISupabaseRealtimeTransport> transportFactory;

        public SupabaseChildCoopAdventureRealtimeClient(
            SupabaseRestClient restClient,
            Func<ISupabaseRealtimeTransport> transportFactory = null)
        {
            if (restClient == null) throw new ArgumentNullException("restClient");
            this.restClient = restClient;
            this.transportFactory = transportFactory;
        }

        public static string GetTopic(string worldOwnerChildProfileId)
        {
            RequireValue(worldOwnerChildProfileId, "worldOwnerChildProfileId");
            return "friend-world:" + worldOwnerChildProfileId.Trim();
        }

        public static bool IsChange(
            SupabaseRealtimeEnvelope envelope,
            string worldOwnerChildProfileId)
        {
            if (envelope == null
                || envelope.Event != "broadcast"
                || string.IsNullOrWhiteSpace(worldOwnerChildProfileId)
                || ContainsControlCharacter(worldOwnerChildProfileId))
            {
                return false;
            }

            if (!string.Equals(
                    envelope.Topic,
                    SupabaseRealtimeProtocol.NormalizeTopic(
                        GetTopic(worldOwnerChildProfileId)),
                    StringComparison.Ordinal))
            {
                return false;
            }

            Dictionary<string, object> broadcast =
                SupabaseRealtimeMessageParser.AsObject(envelope.Payload);
            if (broadcast == null
                || SupabaseRealtimeMessageParser.GetString(broadcast, "type")
                    != "broadcast"
                || SupabaseRealtimeMessageParser.GetString(broadcast, "event")
                    != ChangeEvent)
            {
                return false;
            }

            Dictionary<string, object> payload = SupabaseRealtimeMessageParser.AsObject(
                broadcast.ContainsKey("payload") ? broadcast["payload"] : null);
            Dictionary<string, object> eventPayload = payload ?? broadcast;
            return SupabaseRealtimeMessageParser.GetString(eventPayload, "event")
                == ChangeEvent;
        }

        public async Task<IDisposable> SubscribeAsync(
            string worldOwnerChildProfileId,
            Action onChange,
            CancellationToken cancellationToken)
        {
            RequireValue(worldOwnerChildProfileId, "worldOwnerChildProfileId");
            if (onChange == null) throw new ArgumentNullException("onChange");
            string normalizedOwner = worldOwnerChildProfileId.Trim();
            SupabaseRealtimeChannel channel = restClient.CreateRealtimeChannel(
                transportFactory);
            CancellationTokenSource subscriptionCancellation =
                CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            Action<SupabaseRealtimeEnvelope> messageHandler = (envelope) =>
            {
                if (IsChange(envelope, normalizedOwner)) onChange();
            };
            RealtimeSubscription subscription = new RealtimeSubscription(
                channel,
                messageHandler,
                subscriptionCancellation);
            channel.MessageReceived += messageHandler;
            channel.StateChanged += subscription.HandleStateChanged;
            SupabaseRealtimeChannelOptions options =
                new SupabaseRealtimeChannelOptions
                {
                    Private = true,
                    PresenceEnabled = false,
                    BroadcastSelf = false,
                    BroadcastAck = false,
                };

            try
            {
                await channel.ConnectAsync(
                    GetTopic(normalizedOwner),
                    options,
                    subscriptionCancellation.Token);
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
                    "Co-op adventure realtime " + parameterName + " is invalid.",
                    parameterName);
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

        private sealed class RealtimeSubscription : IDisposable
        {
            private readonly SupabaseRealtimeChannel channel;
            private readonly Action<SupabaseRealtimeEnvelope> messageHandler;
            private readonly CancellationTokenSource lifetimeCancellation;
            private int reconnectInProgress;
            private bool disposed;

            public RealtimeSubscription(
                SupabaseRealtimeChannel channel,
                Action<SupabaseRealtimeEnvelope> messageHandler,
                CancellationTokenSource lifetimeCancellation)
            {
                this.channel = channel;
                this.messageHandler = messageHandler;
                this.lifetimeCancellation = lifetimeCancellation;
            }

            public void HandleStateChanged(
                SupabaseRealtimeChannelState state,
                string ignoredMessage)
            {
                if (state != SupabaseRealtimeChannelState.Reconnecting || disposed)
                {
                    return;
                }

                if (Interlocked.Exchange(ref reconnectInProgress, 1) != 0)
                {
                    return;
                }

                _ = ReconnectAsync();
            }

            private async Task ReconnectAsync()
            {
                try
                {
                    await channel.ReconnectAsync(lifetimeCancellation.Token);
                }
                catch (OperationCanceledException)
                {
                    // The subscription was disposed or the child session ended.
                }
                catch (ObjectDisposedException)
                {
                    // The subscription was disposed while reconnecting.
                }
                finally
                {
                    Interlocked.Exchange(ref reconnectInProgress, 0);
                    if (disposed) lifetimeCancellation.Dispose();
                }
            }

            public void Dispose()
            {
                if (disposed) return;
                disposed = true;
                lifetimeCancellation.Cancel();
                channel.StateChanged -= HandleStateChanged;
                channel.MessageReceived -= messageHandler;
                channel.Dispose();
                if (Interlocked.CompareExchange(ref reconnectInProgress, 0, 0) == 0)
                {
                    lifetimeCancellation.Dispose();
                }
            }
        }
    }
}
