using System.Threading;
using System.Threading.Tasks;

namespace HabitHero.Platform
{
    public sealed class SupabasePushTokenResult
    {
        public SupabasePushTokenResult(
            bool isSupported,
            bool isGranted,
            string token,
            string error)
        {
            IsSupported = isSupported;
            IsGranted = isGranted;
            Token = token;
            Error = error;
        }

        public bool IsSupported { get; private set; }
        public bool IsGranted { get; private set; }
        public string Token { get; private set; }
        public string Error { get; private set; }
    }

    public interface ISupabasePushTokenProvider
    {
        Task<SupabasePushTokenResult> RequestTokenAsync(
            CancellationToken cancellationToken);
    }
}
