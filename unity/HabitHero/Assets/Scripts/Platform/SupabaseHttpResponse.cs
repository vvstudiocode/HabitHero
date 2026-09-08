using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    public sealed class SupabaseHttpResponse
    {
        public SupabaseHttpResponse(long statusCode, string body, string transportError)
        {
            StatusCode = statusCode;
            Body = body ?? string.Empty;
            TransportError = transportError;
        }

        public long StatusCode { get; private set; }

        public string Body { get; private set; }

        public string TransportError { get; private set; }

        public bool IsSuccess
        {
            get
            {
                return string.IsNullOrEmpty(TransportError)
                    && StatusCode >= 200
                    && StatusCode < 300;
            }
        }
    }

    public interface ISupabaseTransport
    {
        Task<SupabaseHttpResponse> SendAsync(
            SupabaseRequestContract request,
            CancellationToken cancellationToken);
    }
}
