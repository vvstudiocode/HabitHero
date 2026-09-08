using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    public enum SupabaseRealtimeChannelState
    {
        Disconnected,
        Connecting,
        Joined,
        Reconnecting,
        Closed,
    }

    public sealed class SupabaseRealtimeChannel : IDisposable
    {
        private const int ReplyTimeoutMilliseconds = 10000;

        private readonly SupabaseClientSettings settings;
        private readonly SupabaseAuthClient authClient;
        private readonly Func<ISupabaseRealtimeTransport> transportFactory;
        private readonly object pendingLock = new object();
        private readonly Dictionary<string, TaskCompletionSource<SupabaseRealtimeEnvelope>> pendingReplies =
            new Dictionary<string, TaskCompletionSource<SupabaseRealtimeEnvelope>>();
        private SupabaseRealtimeChannelState state = SupabaseRealtimeChannelState.Disconnected;
        private ISupabaseRealtimeTransport transport;
        private SupabaseRealtimeChannelOptions options;
        private CancellationTokenSource lifetimeCancellation;
        private Task receiveTask;
        private Task heartbeatTask;
        private string topic;
        private string joinReference;
        private int referenceNumber;
        private bool disposed;

        public SupabaseRealtimeChannel(
            SupabaseClientSettings settings,
            SupabaseAuthClient authClient)
            : this(settings, authClient, null)
        {
        }

        public SupabaseRealtimeChannel(
            SupabaseClientSettings settings,
            SupabaseAuthClient authClient,
            Func<ISupabaseRealtimeTransport> transportFactory)
        {
            if (settings == null) throw new ArgumentNullException("settings");
            if (authClient == null) throw new ArgumentNullException("authClient");
            this.settings = settings;
            this.authClient = authClient;
            this.transportFactory = transportFactory ?? SupabaseRealtimeTransportFactory.Create;
        }

        public event Action<SupabaseRealtimeChannelState, string> StateChanged;

        public event Action<SupabaseRealtimeEnvelope> MessageReceived;

        public SupabaseRealtimeChannelState State
        {
            get { return state; }
        }

        public string Topic
        {
            get { return topic; }
        }

        public string JoinReference
        {
            get { return joinReference; }
        }

        public async Task ConnectAsync(
            string topic,
            SupabaseRealtimeChannelOptions options,
            CancellationToken cancellationToken)
        {
            if (disposed) throw new ObjectDisposedException("SupabaseRealtimeChannel");
            if (string.IsNullOrWhiteSpace(topic)) throw new ArgumentException("Realtime topic is required.", "topic");
            if (State == SupabaseRealtimeChannelState.Joined
                || State == SupabaseRealtimeChannelState.Connecting)
            {
                throw new InvalidOperationException("Realtime channel is already active.");
            }

            await CloseAsync(CancellationToken.None);
            this.topic = topic.Trim();
            this.options = options ?? new SupabaseRealtimeChannelOptions();
            SetState(SupabaseRealtimeChannelState.Connecting, null);

            SupabaseSession session = await authClient.EnsureFreshSessionAsync(cancellationToken);
            if (session == null || !session.HasTokens)
            {
                SetState(SupabaseRealtimeChannelState.Disconnected, "Supabase session is missing.");
                throw new SupabaseDataException("Supabase session is missing.");
            }

            transport = transportFactory();
            if (transport == null) throw new InvalidOperationException("Realtime transport factory returned null.");
            lifetimeCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            Uri socketUri = new Uri(SupabaseRealtimeProtocol.BuildWebSocketUrl(settings));
            try
            {
                await transport.ConnectAsync(socketUri, lifetimeCancellation.Token);
                receiveTask = ReceiveLoopAsync(lifetimeCancellation.Token);
                heartbeatTask = HeartbeatLoopAsync(lifetimeCancellation.Token);
                joinReference = NextReference();
                string reference = NextReference();
                Task<SupabaseRealtimeEnvelope> reply = RegisterReply(reference);
                await transport.SendTextAsync(
                    SupabaseRealtimeProtocol.BuildJoin(
                        this.topic,
                        reference,
                        joinReference,
                        session.AccessToken,
                        this.options),
                    lifetimeCancellation.Token);
                SupabaseRealtimeEnvelope joined = await AwaitReplyAsync(reference, reply, lifetimeCancellation.Token);
                EnsureReplySucceeded(joined, "Supabase Realtime join failed.");
                SetState(SupabaseRealtimeChannelState.Joined, null);
            }
            catch
            {
                await CloseTransportAsync(CancellationToken.None);
                SetState(SupabaseRealtimeChannelState.Disconnected, "Supabase Realtime channel disconnected.");
                throw;
            }
        }

        public async Task UpdateAccessTokenAsync(
            string accessToken,
            CancellationToken cancellationToken)
        {
            EnsureJoined();
            string reference = NextReference();
            await transport.SendTextAsync(
                SupabaseRealtimeProtocol.BuildAccessToken(
                    topic,
                    joinReference,
                    reference,
                    accessToken),
                cancellationToken);
        }

        public async Task BroadcastAsync(
            string eventName,
            string payloadJson,
            CancellationToken cancellationToken)
        {
            EnsureJoined();
            string reference = NextReference();
            Task<SupabaseRealtimeEnvelope> reply = null;
            if (options.BroadcastAck)
            {
                reply = RegisterReply(reference);
            }

            await transport.SendTextAsync(
                SupabaseRealtimeProtocol.BuildBroadcast(
                    topic,
                    joinReference,
                    reference,
                    eventName,
                    payloadJson),
                cancellationToken);
            if (reply != null)
            {
                SupabaseRealtimeEnvelope response = await AwaitReplyAsync(reference, reply, cancellationToken);
                EnsureReplySucceeded(response, "Supabase Realtime broadcast failed.");
            }
        }

        public async Task TrackAsync(string presenceJson, CancellationToken cancellationToken)
        {
            EnsureJoined();
            string reference = NextReference();
            Task<SupabaseRealtimeEnvelope> reply = RegisterReply(reference);
            await transport.SendTextAsync(
                SupabaseRealtimeProtocol.BuildTrack(
                    topic,
                    joinReference,
                    reference,
                    presenceJson),
                cancellationToken);
            SupabaseRealtimeEnvelope response = await AwaitReplyAsync(reference, reply, cancellationToken);
            EnsureReplySucceeded(response, "Supabase Realtime presence track failed.");
        }

        public async Task UntrackAsync(CancellationToken cancellationToken)
        {
            EnsureJoined();
            string reference = NextReference();
            Task<SupabaseRealtimeEnvelope> reply = RegisterReply(reference);
            await transport.SendTextAsync(
                SupabaseRealtimeProtocol.BuildUntrack(topic, joinReference, reference),
                cancellationToken);
            SupabaseRealtimeEnvelope response = await AwaitReplyAsync(reference, reply, cancellationToken);
            EnsureReplySucceeded(response, "Supabase Realtime presence untrack failed.");
        }

        public async Task LeaveAsync(CancellationToken cancellationToken)
        {
            if (State != SupabaseRealtimeChannelState.Joined || transport == null) return;
            string reference = NextReference();
            Task<SupabaseRealtimeEnvelope> reply = RegisterReply(reference);
            await transport.SendTextAsync(
                SupabaseRealtimeProtocol.BuildLeave(topic, joinReference, reference),
                cancellationToken);
            SupabaseRealtimeEnvelope response = await AwaitReplyAsync(reference, reply, cancellationToken);
            EnsureReplySucceeded(response, "Supabase Realtime leave failed.");
        }

        public async Task CloseAsync(CancellationToken cancellationToken)
        {
            if (lifetimeCancellation != null)
            {
                lifetimeCancellation.Cancel();
            }

            FailPendingReplies(new OperationCanceledException("Realtime channel closed."));
            await CloseTransportAsync(cancellationToken);
            if (!disposed) SetState(SupabaseRealtimeChannelState.Disconnected, null);
        }

        public void Dispose()
        {
            if (disposed) return;
            disposed = true;
            if (lifetimeCancellation != null) lifetimeCancellation.Cancel();
            FailPendingReplies(new OperationCanceledException("Realtime channel disposed."));
            if (transport != null) transport.Dispose();
            if (lifetimeCancellation != null)
            {
                lifetimeCancellation.Dispose();
                lifetimeCancellation = null;
            }

            receiveTask = null;
            heartbeatTask = null;
            transport = null;
            SetState(SupabaseRealtimeChannelState.Closed, null);
        }

        private async Task ReceiveLoopAsync(CancellationToken cancellationToken)
        {
            try
            {
                while (!cancellationToken.IsCancellationRequested && transport != null)
                {
                    string rawMessage = await transport.ReceiveTextAsync(cancellationToken);
                    if (string.IsNullOrEmpty(rawMessage))
                    {
                        SetState(SupabaseRealtimeChannelState.Disconnected, "Realtime WebSocket closed.");
                        return;
                    }

                    SupabaseRealtimeEnvelope envelope;
                    string error;
                    if (!SupabaseRealtimeMessageParser.TryParseEnvelope(rawMessage, out envelope, out error))
                    {
                        SetState(SupabaseRealtimeChannelState.Disconnected, error);
                        return;
                    }

                    if (envelope.Event == "phx_reply" && !string.IsNullOrEmpty(envelope.Reference))
                    {
                        CompleteReply(envelope.Reference, envelope);
                    }

                    Action<SupabaseRealtimeEnvelope> listener = MessageReceived;
                    if (listener != null) listener(envelope);
                    if (envelope.Event == "phx_error" || envelope.Event == "phx_close")
                    {
                        SetState(SupabaseRealtimeChannelState.Reconnecting, "Realtime channel requires reconnection.");
                        return;
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // Closing the channel is an expected cancellation path.
            }
            catch (Exception exception)
            {
                SetState(SupabaseRealtimeChannelState.Reconnecting, exception.Message);
                FailPendingReplies(exception);
            }
        }

        private async Task HeartbeatLoopAsync(CancellationToken cancellationToken)
        {
            try
            {
                while (!cancellationToken.IsCancellationRequested)
                {
                    await Task.Delay(
                        SupabaseRealtimeProtocol.HeartbeatIntervalMilliseconds,
                        cancellationToken);
                    if (State != SupabaseRealtimeChannelState.Joined || transport == null) continue;
                    await transport.SendTextAsync(
                        SupabaseRealtimeProtocol.BuildHeartbeat(NextReference()),
                        cancellationToken);
                }
            }
            catch (OperationCanceledException)
            {
                // Closing the channel is an expected cancellation path.
            }
            catch (Exception exception)
            {
                SetState(SupabaseRealtimeChannelState.Reconnecting, exception.Message);
            }
        }

        private Task<SupabaseRealtimeEnvelope> RegisterReply(string reference)
        {
            TaskCompletionSource<SupabaseRealtimeEnvelope> completion =
                new TaskCompletionSource<SupabaseRealtimeEnvelope>();
            lock (pendingLock)
            {
                pendingReplies[reference] = completion;
            }

            return completion.Task;
        }

        private async Task<SupabaseRealtimeEnvelope> AwaitReplyAsync(
            string reference,
            Task<SupabaseRealtimeEnvelope> reply,
            CancellationToken cancellationToken)
        {
            Task timeout = Task.Delay(ReplyTimeoutMilliseconds, cancellationToken);
            Task completed = await Task.WhenAny(reply, timeout);
            if (completed == reply) return await reply;
            RemovePendingReply(reference);
            cancellationToken.ThrowIfCancellationRequested();
            throw new TimeoutException("Supabase Realtime did not acknowledge the request.");
        }

        private void CompleteReply(string reference, SupabaseRealtimeEnvelope envelope)
        {
            TaskCompletionSource<SupabaseRealtimeEnvelope> completion = null;
            lock (pendingLock)
            {
                if (!pendingReplies.TryGetValue(reference, out completion)) return;
                pendingReplies.Remove(reference);
            }

            completion.TrySetResult(envelope);
        }

        private void RemovePendingReply(string reference)
        {
            lock (pendingLock)
            {
                pendingReplies.Remove(reference);
            }
        }

        private void FailPendingReplies(Exception exception)
        {
            KeyValuePair<string, TaskCompletionSource<SupabaseRealtimeEnvelope>>[] replies;
            lock (pendingLock)
            {
                replies = new List<KeyValuePair<string, TaskCompletionSource<SupabaseRealtimeEnvelope>>>(pendingReplies).ToArray();
                pendingReplies.Clear();
            }

            foreach (KeyValuePair<string, TaskCompletionSource<SupabaseRealtimeEnvelope>> reply in replies)
            {
                reply.Value.TrySetException(exception);
            }
        }

        private async Task CloseTransportAsync(CancellationToken cancellationToken)
        {
            ISupabaseRealtimeTransport currentTransport = transport;
            transport = null;
            if (currentTransport == null) return;
            try
            {
                await currentTransport.CloseAsync(cancellationToken);
            }
            catch
            {
                // A disconnected WebSocket is already closed from the caller's perspective.
            }
            finally
            {
                currentTransport.Dispose();
            }
        }

        private string NextReference()
        {
            referenceNumber += 1;
            return referenceNumber.ToString(System.Globalization.CultureInfo.InvariantCulture);
        }

        private void EnsureJoined()
        {
            if (State != SupabaseRealtimeChannelState.Joined || transport == null || !transport.IsOpen)
            {
                throw new InvalidOperationException("Supabase Realtime channel is not joined.");
            }
        }

        private static void EnsureReplySucceeded(SupabaseRealtimeEnvelope envelope, string prefix)
        {
            Dictionary<string, object> payload = SupabaseRealtimeMessageParser.AsObject(envelope.Payload);
            string status = SupabaseRealtimeMessageParser.GetString(payload, "status");
            if (string.Equals(status, "ok", StringComparison.OrdinalIgnoreCase)) return;

            Dictionary<string, object> response = payload == null
                ? null
                : SupabaseRealtimeMessageParser.AsObject(
                    payload.ContainsKey("response") ? payload["response"] : null);
            string reason = SupabaseRealtimeMessageParser.GetString(response, "reason")
                ?? SupabaseRealtimeMessageParser.GetString(response, "error")
                ?? "unknown";
            throw new SupabaseDataException(prefix + " " + reason);
        }

        private void SetState(SupabaseRealtimeChannelState nextState, string message)
        {
            state = nextState;
            Action<SupabaseRealtimeChannelState, string> listener = StateChanged;
            if (listener != null) listener(nextState, message);
        }
    }
}
