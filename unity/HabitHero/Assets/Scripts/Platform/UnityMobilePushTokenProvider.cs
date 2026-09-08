using System.Threading;
using System.Threading.Tasks;

#if UNITY_IOS && !UNITY_EDITOR
using Unity.Notifications.iOS;
#endif

namespace HabitHero.Platform
{
    public sealed class UnityMobilePushTokenProvider : ISupabasePushTokenProvider
    {
        public async Task<SupabasePushTokenResult> RequestTokenAsync(
            CancellationToken cancellationToken)
        {
#if UNITY_IOS && !UNITY_EDITOR
            using (AuthorizationRequest request = new AuthorizationRequest(
                AuthorizationOption.Alert
                    | AuthorizationOption.Badge
                    | AuthorizationOption.Sound,
                true))
            {
                while (!request.IsFinished)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    await Task.Yield();
                }

                if (!request.Granted)
                {
                    return new SupabasePushTokenResult(
                        true,
                        false,
                        null,
                        string.IsNullOrWhiteSpace(request.Error)
                            ? "使用者未允許通知。"
                            : request.Error);
                }

                if (string.IsNullOrWhiteSpace(request.DeviceToken))
                {
                    return new SupabasePushTokenResult(
                        true,
                        false,
                        null,
                        "iOS 尚未取得 Push Token，請重新啟動 App 後再試。");
                }

                return new SupabasePushTokenResult(
                    true,
                    true,
                    request.DeviceToken,
                    null);
            }
#else
            await Task.Yield();
            return new SupabasePushTokenResult(
                false,
                false,
                null,
                "目前只有 iOS 原生 App 支援背景通知 token。");
#endif
        }
    }
}
