using System;
using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    public interface ISupabaseRealtimeTransport : IDisposable
    {
        bool IsOpen { get; }

        Task ConnectAsync(Uri uri, CancellationToken cancellationToken);

        Task SendTextAsync(string message, CancellationToken cancellationToken);

        Task<string> ReceiveTextAsync(CancellationToken cancellationToken);

        Task CloseAsync(CancellationToken cancellationToken);
    }

    public static class SupabaseRealtimeTransportFactory
    {
        public static ISupabaseRealtimeTransport Create()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            return SupabaseWebGlRealtimeTransport.Create();
#else
            return new SupabaseClientWebSocketTransport();
#endif
        }
    }
}
