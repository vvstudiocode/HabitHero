using System;
using System.Collections.Generic;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    public sealed class SupabaseChildFriendWorldRealtimeSubscription : IDisposable
    {
        private readonly SupabaseRealtimeChannel channel;
        private readonly string worldOwnerChildProfileId;
        private readonly CancellationTokenSource lifetimeCancellation;
        private readonly Action<SupabaseRealtimeEnvelope> messageHandler;
        private readonly Action<SupabaseRealtimeChannelState, string> stateHandler;
        private readonly SupabaseFriendWorldAvatarStateTracker avatarStateTracker =
            new SupabaseFriendWorldAvatarStateTracker();
        private readonly Dictionary<string, SupabaseFriendWorldPresenceMember> members =
            new Dictionary<string, SupabaseFriendWorldPresenceMember>();
        private readonly Action<SupabaseFriendWorldPresenceMember[]> onPresence;
        private readonly Action<SupabaseFriendWorldAvatarState> onAvatarState;
        private readonly Action onAvatarStateRequest;
        private readonly Action onWorldRevision;
        private readonly string connectionId;
        private readonly string childProfileId;
        private int reconnectInProgress;
        private bool initialConnectionPending = true;
        private bool disposed;

        internal SupabaseChildFriendWorldRealtimeSubscription(
            SupabaseRealtimeChannel channel,
            string worldOwnerChildProfileId,
            string connectionId,
            string childProfileId,
            CancellationTokenSource lifetimeCancellation,
            Action<SupabaseFriendWorldPresenceMember[]> onPresence,
            Action<SupabaseFriendWorldAvatarState> onAvatarState,
            Action onAvatarStateRequest,
            Action onWorldRevision)
        {
            this.channel = channel;
            this.worldOwnerChildProfileId = worldOwnerChildProfileId;
            this.connectionId = connectionId;
            this.childProfileId = childProfileId;
            this.lifetimeCancellation = lifetimeCancellation;
            this.onPresence = onPresence;
            this.onAvatarState = onAvatarState;
            this.onAvatarStateRequest = onAvatarStateRequest;
            this.onWorldRevision = onWorldRevision;
            messageHandler = HandleMessage;
            stateHandler = HandleStateChanged;
            channel.MessageReceived += messageHandler;
            channel.StateChanged += stateHandler;
        }

        internal async Task TrackInitialAsync(CancellationToken cancellationToken)
        {
            await TrackAsync(cancellationToken);
            initialConnectionPending = false;
        }

        public Task BroadcastAvatarStateAsync(
            SupabaseFriendWorldAvatarState state,
            CancellationToken cancellationToken)
        {
            if (state == null) throw new ArgumentNullException("state");
            return channel.BroadcastAsync(
                SupabaseFriendWorldRealtimeContracts.AvatarStateEvent,
                SupabaseChildFriendWorldRealtimeMapper.BuildAvatarStatePayload(state),
                cancellationToken);
        }

        public Task RequestLatestAvatarStateAsync(CancellationToken cancellationToken)
        {
            return channel.BroadcastAsync(
                SupabaseFriendWorldRealtimeContracts.AvatarStateRequestEvent,
                "{\"connectionId\":" + SupabaseJson.Quote(connectionId) + "}",
                cancellationToken);
        }

        private Task TrackAsync(CancellationToken cancellationToken)
        {
            return channel.TrackAsync(
                SupabaseChildFriendWorldRealtimeClient.BuildPresencePayload(
                    connectionId,
                    childProfileId,
                    DateTime.UtcNow.ToString("o", CultureInfo.InvariantCulture)),
                cancellationToken);
        }

        private void HandleMessage(SupabaseRealtimeEnvelope envelope)
        {
            SupabaseFriendWorldPresenceMember[] mappedMembers;
            if (SupabaseChildFriendWorldRealtimeMapper.TryMapPresenceState(
                    envelope,
                    worldOwnerChildProfileId,
                    out mappedMembers))
            {
                members.Clear();
                foreach (SupabaseFriendWorldPresenceMember member in mappedMembers)
                    members[member.connectionId] = member;
                NotifyPresence();
                return;
            }

            SupabaseFriendWorldPresenceMember[] joins;
            string[] leaves;
            if (SupabaseChildFriendWorldRealtimeMapper.TryMapPresenceDiff(
                    envelope,
                    worldOwnerChildProfileId,
                    out joins,
                    out leaves))
            {
                foreach (string connection in leaves) members.Remove(connection);
                foreach (SupabaseFriendWorldPresenceMember member in joins)
                    members[member.connectionId] = member;
                NotifyPresence();
                return;
            }

            SupabaseFriendWorldAvatarState avatarState;
            if (avatarStateTracker.TryAccept(
                    envelope,
                    worldOwnerChildProfileId,
                    out avatarState))
            {
                if (onAvatarState != null) onAvatarState(avatarState);
                return;
            }

            string requesterConnectionId;
            if (SupabaseChildFriendWorldRealtimeMapper.TryMapAvatarStateRequest(
                    envelope,
                    worldOwnerChildProfileId,
                    out requesterConnectionId))
            {
                if (onAvatarStateRequest != null) onAvatarStateRequest();
                return;
            }

            if (SupabaseChildFriendWorldRealtimeMapper.IsWorldRevision(
                    envelope,
                    worldOwnerChildProfileId)
                && onWorldRevision != null)
            {
                onWorldRevision();
            }
        }

        private void NotifyPresence()
        {
            if (onPresence == null) return;
            List<SupabaseFriendWorldPresenceMember> snapshot =
                new List<SupabaseFriendWorldPresenceMember>(members.Values);
            snapshot.Sort((left, right) => string.CompareOrdinal(left.connectionId, right.connectionId));
            onPresence(snapshot.ToArray());
        }

        private void HandleStateChanged(
            SupabaseRealtimeChannelState state,
            string ignoredMessage)
        {
            if (disposed) return;
            if (state == SupabaseRealtimeChannelState.Reconnecting)
            {
                if (Interlocked.Exchange(ref reconnectInProgress, 1) == 0)
                    _ = ReconnectAsync();
            }
            else if (state == SupabaseRealtimeChannelState.Joined && !initialConnectionPending)
            {
                _ = TrackAfterReconnectAsync();
            }
        }

        private async Task TrackAfterReconnectAsync()
        {
            try
            {
                await TrackAsync(lifetimeCancellation.Token);
            }
            catch (OperationCanceledException)
            {
                // Disposal or session shutdown canceled the re-track.
            }
            catch
            {
                if (!disposed) HandleStateChanged(
                    SupabaseRealtimeChannelState.Reconnecting,
                    "Presence re-track failed.");
            }
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
                // The channel was disposed while reconnecting.
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
            channel.StateChanged -= stateHandler;
            channel.MessageReceived -= messageHandler;
            channel.Dispose();
            if (Interlocked.CompareExchange(ref reconnectInProgress, 0, 0) == 0)
                lifetimeCancellation.Dispose();
        }
    }
}
