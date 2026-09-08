using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;

#if UNITY_WEBGL && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

namespace HabitHero.Platform
{
    public sealed class SupabaseWebGlRealtimeTransport : MonoBehaviour, ISupabaseRealtimeTransport
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern void HabitHeroRealtimeConnect(string targetObjectName, string url);

        [DllImport("__Internal")]
        private static extern void HabitHeroRealtimeSend(string targetObjectName, string message);

        [DllImport("__Internal")]
        private static extern void HabitHeroRealtimeClose(string targetObjectName);
#endif

        private static int nextTransportId;
        private readonly Queue<string> messages = new Queue<string>();
        private string targetObjectName;
        private bool open;
        private bool disposed;
        private TaskCompletionSource<bool> openCompletion;
        private TaskCompletionSource<string> messageCompletion;

        public static SupabaseWebGlRealtimeTransport Create()
        {
            GameObject gameObject = new GameObject(
                "HabitHeroRealtimeTransport-" + (++nextTransportId));
            DontDestroyOnLoad(gameObject);
            SupabaseWebGlRealtimeTransport transport =
                gameObject.AddComponent<SupabaseWebGlRealtimeTransport>();
            transport.targetObjectName = gameObject.name;
            return transport;
        }

        public bool IsOpen
        {
            get { return open && !disposed; }
        }

        public async Task ConnectAsync(Uri uri, CancellationToken cancellationToken)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            if (uri == null) throw new ArgumentNullException("uri");
            if (disposed) throw new ObjectDisposedException("SupabaseWebGlRealtimeTransport");
            openCompletion = new TaskCompletionSource<bool>();
            HabitHeroRealtimeConnect(targetObjectName, uri.ToString());
            Task timeout = Task.Delay(10000, cancellationToken);
            Task completed = await Task.WhenAny(openCompletion.Task, timeout);
            if (completed != openCompletion.Task)
            {
                cancellationToken.ThrowIfCancellationRequested();
                throw new TimeoutException("Supabase Realtime WebGL connection timed out.");
            }

            await openCompletion.Task;
#else
            await Task.FromException(new PlatformNotSupportedException(
                "SupabaseWebGlRealtimeTransport is only available in a WebGL player."));
#endif
        }

        public Task SendTextAsync(string message, CancellationToken cancellationToken)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            cancellationToken.ThrowIfCancellationRequested();
            if (!IsOpen) throw new InvalidOperationException("Realtime WebSocket is not open.");
            if (message == null) throw new ArgumentNullException("message");
            HabitHeroRealtimeSend(targetObjectName, message);
            return Task.CompletedTask;
#else
            throw new PlatformNotSupportedException(
                "SupabaseWebGlRealtimeTransport is only available in a WebGL player.");
#endif
        }

        public Task<string> ReceiveTextAsync(CancellationToken cancellationToken)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            cancellationToken.ThrowIfCancellationRequested();
            if (messages.Count > 0) return Task.FromResult(messages.Dequeue());
            if (!IsOpen) return Task.FromResult<string>(null);
            if (messageCompletion != null)
            {
                throw new InvalidOperationException("Only one WebGL realtime receive may be active.");
            }

            messageCompletion = new TaskCompletionSource<string>();
            cancellationToken.Register(() => messageCompletion.TrySetCanceled());
            return AwaitMessageAsync();
#else
            throw new PlatformNotSupportedException(
                "SupabaseWebGlRealtimeTransport is only available in a WebGL player.");
#endif
        }

        public Task CloseAsync(CancellationToken cancellationToken)
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            cancellationToken.ThrowIfCancellationRequested();
            if (open)
            {
                HabitHeroRealtimeClose(targetObjectName);
            }

            open = false;
            CompleteMessage(null);
            return Task.CompletedTask;
#else
            return Task.CompletedTask;
#endif
        }

        public void Dispose()
        {
            if (disposed) return;
            disposed = true;
#if UNITY_WEBGL && !UNITY_EDITOR
            if (open) HabitHeroRealtimeClose(targetObjectName);
#endif
            open = false;
            if (messageCompletion != null) CompleteMessage(null);
            if (gameObject != null) Destroy(gameObject);
        }

        public void OnRealtimeOpen(string ignored)
        {
            open = true;
            if (openCompletion != null) openCompletion.TrySetResult(true);
        }

        public void OnRealtimeMessage(string message)
        {
            if (!open || disposed) return;
            if (messageCompletion != null)
            {
                CompleteMessage(message);
                return;
            }

            messages.Enqueue(message ?? string.Empty);
        }

        public void OnRealtimeError(string error)
        {
            open = false;
            Exception exception = new InvalidOperationException(
                string.IsNullOrEmpty(error) ? "Supabase Realtime WebGL socket failed." : error);
            if (openCompletion != null) openCompletion.TrySetException(exception);
            if (messageCompletion != null) messageCompletion.TrySetException(exception);
        }

        public void OnRealtimeClose(string ignored)
        {
            open = false;
            CompleteMessage(null);
        }

#if UNITY_WEBGL && !UNITY_EDITOR
        private async Task<string> AwaitMessageAsync()
        {
            TaskCompletionSource<string> completion = messageCompletion;
            string message = await completion.Task;
            return message;
        }

        private void CompleteMessage(string message)
        {
            TaskCompletionSource<string> completion = messageCompletion;
            messageCompletion = null;
            if (completion != null) completion.TrySetResult(message);
        }
#else
        private Task<string> AwaitMessageAsync()
        {
            return Task.FromResult<string>(null);
        }

        private void CompleteMessage(string message) { }
#endif
    }
}
