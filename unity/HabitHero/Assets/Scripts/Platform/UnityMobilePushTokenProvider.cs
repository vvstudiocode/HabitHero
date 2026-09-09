using System.Threading;
using System.Threading.Tasks;

#if UNITY_ANDROID && !UNITY_EDITOR
using UnityEngine;
#endif

#if UNITY_IOS && !UNITY_EDITOR
using Unity.Notifications.iOS;
#endif

namespace HabitHero.Platform
{
    public sealed class UnityMobilePushTokenProvider : ISupabasePushTokenProvider
    {
        public bool IsSupported
        {
            get
            {
#if UNITY_IOS && !UNITY_EDITOR
                return true;
#elif UNITY_ANDROID && !UNITY_EDITOR
                return true;
#else
                return false;
#endif
            }
        }

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
#elif UNITY_ANDROID && !UNITY_EDITOR
            return await RequestAndroidTokenAsync(cancellationToken);
#else
            await Task.Yield();
            return new SupabasePushTokenResult(
                false,
                false,
                null,
                "目前只有 iOS 原生 App 支援背景通知 token。");
#endif
        }

#if UNITY_ANDROID && !UNITY_EDITOR
        private static async Task<SupabasePushTokenResult> RequestAndroidTokenAsync(
            CancellationToken cancellationToken)
        {
            try
            {
                using (AndroidJavaClass player = new AndroidJavaClass(
                    "com.unity3d.player.UnityPlayer"))
                using (AndroidJavaObject activity = player.GetStatic<AndroidJavaObject>(
                    "currentActivity"))
                using (AndroidJavaClass bridge = new AndroidJavaClass(
                    "com.vvstudiocode.habithero.HabitHeroFirebaseMessagingBridge"))
                {
                    bool requested = bridge.CallStatic<bool>("requestToken", activity);
                    if (!requested)
                    {
                        return new SupabasePushTokenResult(
                            true,
                            false,
                            null,
                            bridge.CallStatic<string>("getError")
                                ?? "Android 尚未設定 Firebase Cloud Messaging。");
                    }

                    const int timeoutMilliseconds = 15000;
                    int elapsedMilliseconds = 0;
                    while (elapsedMilliseconds < timeoutMilliseconds)
                    {
                        cancellationToken.ThrowIfCancellationRequested();
                        if (bridge.CallStatic<bool>("isTokenReady"))
                        {
                            string token = bridge.CallStatic<string>("getToken");
                            if (!string.IsNullOrWhiteSpace(token))
                            {
                                return new SupabasePushTokenResult(
                                    true,
                                    true,
                                    token,
                                    null);
                            }
                        }

                        if (bridge.CallStatic<bool>("hasError"))
                        {
                            return new SupabasePushTokenResult(
                                true,
                                false,
                                null,
                                bridge.CallStatic<string>("getError")
                                    ?? "Android Push Token 取得失敗。");
                        }

                        await Task.Delay(100, cancellationToken);
                        elapsedMilliseconds += 100;
                    }

                    return new SupabasePushTokenResult(
                        true,
                        false,
                        null,
                        bridge.CallStatic<string>("getError")
                            ?? "Android 尚未取得 Push Token，請確認 Google Play 服務與 Firebase 設定。");
                }
            }
            catch (System.OperationCanceledException)
            {
                throw;
            }
            catch (System.Exception exception)
            {
                return new SupabasePushTokenResult(
                    true,
                    false,
                    null,
                    "Android Push 初始化失敗：" + exception.Message);
            }
        }
#endif
    }
}
