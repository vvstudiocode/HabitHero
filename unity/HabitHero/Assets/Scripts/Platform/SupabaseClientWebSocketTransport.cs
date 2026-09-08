using System;
using System.IO;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
#if UNITY_WEBGL && !UNITY_EDITOR
    public sealed class SupabaseClientWebSocketTransport : ISupabaseRealtimeTransport
    {
        public bool IsOpen { get { return false; } }

        public Task ConnectAsync(Uri uri, CancellationToken cancellationToken)
        {
            throw new PlatformNotSupportedException(
                "ClientWebSocket is not available in Unity WebGL; use the WebGL transport.");
        }

        public Task SendTextAsync(string message, CancellationToken cancellationToken)
        {
            throw new PlatformNotSupportedException(
                "ClientWebSocket is not available in Unity WebGL; use the WebGL transport.");
        }

        public Task<string> ReceiveTextAsync(CancellationToken cancellationToken)
        {
            throw new PlatformNotSupportedException(
                "ClientWebSocket is not available in Unity WebGL; use the WebGL transport.");
        }

        public Task CloseAsync(CancellationToken cancellationToken)
        {
            return Task.CompletedTask;
        }

        public void Dispose() { }
    }
#else
    public sealed class SupabaseClientWebSocketTransport : ISupabaseRealtimeTransport
    {
        private ClientWebSocket socket;

        public bool IsOpen
        {
            get { return socket != null && socket.State == WebSocketState.Open; }
        }

        public async Task ConnectAsync(Uri uri, CancellationToken cancellationToken)
        {
            if (uri == null) throw new ArgumentNullException("uri");
            DisposeSocket();
            socket = new ClientWebSocket();
            try
            {
                await socket.ConnectAsync(uri, cancellationToken);
            }
            catch
            {
                DisposeSocket();
                throw;
            }
        }

        public async Task SendTextAsync(string message, CancellationToken cancellationToken)
        {
            if (!IsOpen) throw new InvalidOperationException("Realtime WebSocket is not open.");
            if (message == null) throw new ArgumentNullException("message");
            byte[] bytes = Encoding.UTF8.GetBytes(message);
            await socket.SendAsync(
                new ArraySegment<byte>(bytes),
                WebSocketMessageType.Text,
                true,
                cancellationToken);
        }

        public async Task<string> ReceiveTextAsync(CancellationToken cancellationToken)
        {
            if (!IsOpen) throw new InvalidOperationException("Realtime WebSocket is not open.");
            byte[] buffer = new byte[8192];
            using (MemoryStream message = new MemoryStream())
            {
                while (true)
                {
                    WebSocketReceiveResult result = await socket.ReceiveAsync(
                        new ArraySegment<byte>(buffer),
                        cancellationToken);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        return null;
                    }

                    if (result.MessageType != WebSocketMessageType.Text)
                    {
                        throw new InvalidDataException(
                            "Supabase Realtime protocol 1.0 requires text WebSocket frames.");
                    }

                    message.Write(buffer, 0, result.Count);
                    if (result.EndOfMessage)
                    {
                        return Encoding.UTF8.GetString(message.ToArray());
                    }
                }
            }
        }

        public async Task CloseAsync(CancellationToken cancellationToken)
        {
            if (socket == null) return;
            try
            {
                if (socket.State == WebSocketState.Open
                    || socket.State == WebSocketState.CloseReceived)
                {
                    await socket.CloseAsync(
                        WebSocketCloseStatus.NormalClosure,
                        "HabitHero closed the realtime channel.",
                        cancellationToken);
                }
            }
            finally
            {
                DisposeSocket();
            }
        }

        public void Dispose()
        {
            DisposeSocket();
        }

        private void DisposeSocket()
        {
            if (socket == null) return;
            socket.Dispose();
            socket = null;
        }
    }
#endif
}
