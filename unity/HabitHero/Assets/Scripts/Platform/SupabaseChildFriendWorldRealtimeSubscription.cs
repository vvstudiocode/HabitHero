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
        private readonly Action<bool> onCapacityChanged;
        private readonly string connectionId;
        private readonly string childProfileId;
        private int reconnectInProgress;
        private int capacityOperationInProgress;
        private bool initialConnectionPending = true;
        private bool localAdmissionAccepted;
        private bool tracked;
        private bool capacityCallbackInitialized;
        private bool lastCapacityCrowded;
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
            Action onWorldRevision,
            Action<bool> onCapacityChanged)
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
            this.onCapacityChanged = onCapacityChanged;
            messageHandler = HandleMessage;
            stateHandler = HandleStateChanged;
            channel.MessageReceived += messageHandler;
            channel.StateChanged += stateHandler;
        }

        internal async Task TrackInitialAsync(CancellationToken cancellationToken)
        {
            await TrackAsync(cancellationToken);
            tracked = true;
            initialConnectionPending = false;
            UpdatePresenceAdmission();
        }

        public bool IsAdmissionAccepted
        {
            get { return localAdmissionAccepted; }
        }

        public Task BroadcastAvatarStateAsync(
            SupabaseFriendWorldAvatarState state,
            CancellationToken cancellationToken)
        {
            if (state == null) throw new ArgumentNullException("state");
            if (!localAdmissionAccepted || !tracked || !HasOtherAdmittedMember())
                return Task.CompletedTask;
            return channel.BroadcastAsync(
                SupabaseFriendWorldRealtimeContracts.AvatarStateEvent,
                SupabaseChildFriendWorldRealtimeMapper.BuildAvatarStatePayload(state),
                cancellationToken);
        }

        public Task RequestLatestAvatarStateAsync(CancellationToken cancellationToken)
        {
            if (!localAdmissionAccepted || !tracked || !HasOtherAdmittedMember())
                return Task.CompletedTask;
            return channel.BroadcastAsync(
                SupabaseFriendWorldRealtimeContracts.AvatarStateRequestEvent,
                "{\"connectionId\":" + SupabaseJson.Quote(connectionId) + "}",
                cancellationToken);
        }

        public SupabaseFriendWorldPresenceMember[] GetPresenceSnapshot()
        {
            return BuildAdmittedPresenceSnapshot();
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
                UpdatePresenceAdmission();
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
                UpdatePresenceAdmission();
                return;
            }

            SupabaseFriendWorldAvatarState avatarState;
            if (avatarStateTracker.TryAccept(
                    envelope,
                    worldOwnerChildProfileId,
                    out avatarState))
            {
                if (!IsAdmittedRemoteAvatar(avatarState))
                {
                    avatarStateTracker.Clear(avatarState.connectionId);
                    return;
                }
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
            onPresence(BuildAdmittedPresenceSnapshot());
        }

        private SupabaseFriendWorldPresenceMember[] BuildPresenceSnapshot()
        {
            List<SupabaseFriendWorldPresenceMember> snapshot =
                new List<SupabaseFriendWorldPresenceMember>(members.Values);
            snapshot.Sort(SupabaseFriendWorldPresenceAdmission.CompareMembers);
            return snapshot.ToArray();
        }

        private SupabaseFriendWorldPresenceMember[] BuildAdmittedPresenceSnapshot()
        {
            SupabaseFriendWorldPresenceMember[] snapshot = BuildPresenceSnapshot();
            SupabaseFriendWorldPresenceAdmissionDecision decision =
                SupabaseFriendWorldPresenceAdmission.Decide(snapshot, connectionId);
            List<SupabaseFriendWorldPresenceMember> admitted =
                new List<SupabaseFriendWorldPresenceMember>();
            foreach (SupabaseFriendWorldPresenceMember member in snapshot)
            {
                if (Array.IndexOf(decision.acceptedConnectionIds, member.connectionId) >= 0)
                    admitted.Add(member);
            }

            return admitted.ToArray();
        }

        private void UpdatePresenceAdmission()
        {
            SupabaseFriendWorldPresenceAdmissionDecision decision =
                SupabaseFriendWorldPresenceAdmission.Decide(
                    BuildPresenceSnapshot(),
                    connectionId);
            localAdmissionAccepted = decision.accepted;
            NotifyCapacityChanged(decision.shouldUntrack);

            if (disposed || initialConnectionPending || channel.State != SupabaseRealtimeChannelState.Joined)
                return;
            if (decision.shouldUntrack && tracked)
            {
                StartCapacityOperation(true);
            }
            else if (!decision.shouldUntrack && !tracked)
            {
                StartCapacityOperation(false);
            }
            else if (!decision.shouldUntrack && HasOtherAdmittedMember())
            {
                _ = RequestLatestAvatarStateAsync(lifetimeCancellation.Token);
            }
        }

        private void NotifyCapacityChanged(bool crowded)
        {
            if (onCapacityChanged == null
                || (capacityCallbackInitialized && lastCapacityCrowded == crowded))
                return;
            capacityCallbackInitialized = true;
            lastCapacityCrowded = crowded;
            onCapacityChanged(crowded);
        }

        private void StartCapacityOperation(bool untrack)
        {
            if (Interlocked.CompareExchange(ref capacityOperationInProgress, 1, 0) != 0)
                return;
            _ = (untrack ? UntrackForCapacityAsync() : TrackForCapacityAsync());
        }

        private async Task UntrackForCapacityAsync()
        {
            try
            {
                await channel.UntrackAsync(lifetimeCancellation.Token);
                tracked = false;
            }
            catch (OperationCanceledException)
            {
                tracked = false;
            }
            catch
            {
                if (!disposed) HandleStateChanged(
                    SupabaseRealtimeChannelState.Reconnecting,
                    "Presence capacity untrack failed.");
            }
            finally
            {
                Interlocked.Exchange(ref capacityOperationInProgress, 0);
                if (!disposed) UpdatePresenceAdmission();
            }
        }

        private async Task TrackForCapacityAsync()
        {
            try
            {
                await TrackAsync(lifetimeCancellation.Token);
                tracked = true;
            }
            catch (OperationCanceledException)
            {
                // Disposal or session shutdown canceled the capacity re-track.
            }
            catch
            {
                if (!disposed) HandleStateChanged(
                    SupabaseRealtimeChannelState.Reconnecting,
                    "Presence capacity track failed.");
            }
            finally
            {
                Interlocked.Exchange(ref capacityOperationInProgress, 0);
                if (!disposed) UpdatePresenceAdmission();
            }
        }

        private bool HasOtherAdmittedMember()
        {
            SupabaseFriendWorldPresenceAdmissionDecision decision =
                SupabaseFriendWorldPresenceAdmission.Decide(
                    BuildPresenceSnapshot(),
                    connectionId);
            int otherMemberCount = 0;
            foreach (string acceptedConnectionId in decision.acceptedConnectionIds)
            {
                if (acceptedConnectionId != connectionId) otherMemberCount += 1;
            }

            return otherMemberCount > 0;
        }

        private bool IsAdmittedRemoteAvatar(SupabaseFriendWorldAvatarState state)
        {
            if (members.Count == 0) return true;
            SupabaseFriendWorldPresenceMember member;
            if (!members.TryGetValue(state.connectionId, out member)) return false;
            if (!string.IsNullOrEmpty(member.childProfileId)
                && member.childProfileId != state.childProfileId)
                return false;

            SupabaseFriendWorldPresenceAdmissionDecision decision =
                SupabaseFriendWorldPresenceAdmission.Decide(
                    BuildPresenceSnapshot(),
                    connectionId);
            return Array.IndexOf(
                    decision.acceptedConnectionIds,
                    state.connectionId) >= 0;
        }

        private void HandleStateChanged(
            SupabaseRealtimeChannelState state,
            string ignoredMessage)
        {
            if (disposed) return;
            if (state == SupabaseRealtimeChannelState.Reconnecting)
            {
                tracked = false;
                localAdmissionAccepted = false;
                members.Clear();
                avatarStateTracker.Clear();
                NotifyPresence();
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
                tracked = true;
                UpdatePresenceAdmission();
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
            tracked = false;
            localAdmissionAccepted = false;
            lifetimeCancellation.Cancel();
            channel.StateChanged -= stateHandler;
            channel.MessageReceived -= messageHandler;
            channel.Dispose();
            if (Interlocked.CompareExchange(ref reconnectInProgress, 0, 0) == 0)
                lifetimeCancellation.Dispose();
        }
    }
}
