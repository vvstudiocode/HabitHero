using System;
using System.Threading;
using System.Threading.Tasks;
using HabitHero.Platform;

namespace HabitHero.App
{
    public sealed class HabitHeroNotificationSettingsState
    {
        public HabitHeroNotificationSettingsState(
            bool enabled,
            bool supported,
            bool granted,
            string error)
        {
            Enabled = enabled;
            Supported = supported;
            Granted = granted;
            Error = error;
        }

        public bool Enabled { get; private set; }
        public bool Supported { get; private set; }
        public bool Granted { get; private set; }
        public string Error { get; private set; }
    }

    public sealed class HabitHeroNotificationSettingsController : IDisposable
    {
        private readonly SupabaseNotificationClient client;
        private readonly ISupabasePushTokenProvider tokenProvider;
        private readonly string familyId;
        private readonly string profileId;
        private readonly string childProfileId;
        private readonly string platform;
        private readonly SemaphoreSlim mutationLock = new SemaphoreSlim(1, 1);
        private bool preferenceLoaded;
        private bool enabled;
        private bool disposed;
        private string lastError;

        public HabitHeroNotificationSettingsController(
            SupabaseNotificationClient client,
            ISupabasePushTokenProvider tokenProvider,
            string familyId,
            string profileId,
            string childProfileId,
            string platform)
        {
            if (client == null) throw new ArgumentNullException("client");
            if (tokenProvider == null) throw new ArgumentNullException("tokenProvider");
            if (string.IsNullOrWhiteSpace(familyId))
            {
                throw new ArgumentException("家庭 ID 不可為空。", "familyId");
            }
            if (string.IsNullOrWhiteSpace(profileId))
            {
                throw new ArgumentException("使用者 ID 不可為空。", "profileId");
            }
            if (string.IsNullOrWhiteSpace(platform))
            {
                throw new ArgumentException("通知平台不可為空。", "platform");
            }

            this.client = client;
            this.tokenProvider = tokenProvider;
            this.familyId = familyId.Trim();
            this.profileId = profileId.Trim();
            this.childProfileId = string.IsNullOrWhiteSpace(childProfileId)
                ? null
                : childProfileId.Trim();
            this.platform = platform.Trim().ToLowerInvariant();
        }

        public async Task<HabitHeroNotificationSettingsState> LoadAsync(
            CancellationToken cancellationToken)
        {
            await mutationLock.WaitAsync(cancellationToken);
            try
            {
                ThrowIfDisposed();
                await LoadPreferenceLockedAsync(cancellationToken);
                return CreateState(false);
            }
            finally
            {
                mutationLock.Release();
            }
        }

        public async Task<HabitHeroNotificationSettingsState> EnsureRegisteredAsync(
            CancellationToken cancellationToken)
        {
            await mutationLock.WaitAsync(cancellationToken);
            try
            {
                ThrowIfDisposed();
                await LoadPreferenceLockedAsync(cancellationToken);
                if (!enabled || !tokenProvider.IsSupported)
                {
                    return CreateState(false);
                }

                SupabasePushTokenResult result =
                    await client.RegisterCurrentDeviceAsync(
                        tokenProvider,
                        familyId,
                        profileId,
                        childProfileId,
                        platform,
                        cancellationToken);
                if (result == null || !result.IsSupported || !result.IsGranted)
                {
                    lastError = result == null
                        ? "通知平台沒有回傳結果。"
                        : result.Error;
                    return CreateState(
                        result != null && result.IsGranted);
                }

                lastError = null;
                return CreateState(true);
            }
            finally
            {
                mutationLock.Release();
            }
        }

        public async Task<HabitHeroNotificationSettingsState> SetEnabledAsync(
            bool nextEnabled,
            CancellationToken cancellationToken)
        {
            await mutationLock.WaitAsync(cancellationToken);
            try
            {
                ThrowIfDisposed();
                await LoadPreferenceLockedAsync(cancellationToken);
                if (!nextEnabled)
                {
                    await client.SetPreferenceAsync(
                        profileId,
                        false,
                        cancellationToken);
                    enabled = false;
                    lastError = null;
                    return CreateState(false);
                }

                if (!tokenProvider.IsSupported)
                {
                    lastError = "目前只有 iOS 原生 App 支援背景通知 token。";
                    return CreateState(false);
                }

                SupabasePushTokenResult result =
                    await client.RegisterCurrentDeviceAsync(
                        tokenProvider,
                        familyId,
                        profileId,
                        childProfileId,
                        platform,
                        cancellationToken);
                if (result == null || !result.IsSupported || !result.IsGranted)
                {
                    lastError = result == null
                        ? "通知平台沒有回傳結果。"
                        : result.Error;
                    return CreateState(enabled);
                }

                await client.SetPreferenceAsync(
                    profileId,
                    true,
                    cancellationToken);
                enabled = true;
                lastError = null;
                return CreateState(true, true);
            }
            finally
            {
                mutationLock.Release();
            }
        }

        public void Dispose()
        {
            disposed = true;
        }

        private async Task LoadPreferenceLockedAsync(
            CancellationToken cancellationToken)
        {
            if (preferenceLoaded) return;
            enabled = await client.LoadPreferenceAsync(
                profileId,
                cancellationToken);
            preferenceLoaded = true;
        }

        private HabitHeroNotificationSettingsState CreateState(
            bool granted,
            bool overrideEnabled = false)
        {
            return new HabitHeroNotificationSettingsState(
                overrideEnabled || enabled,
                tokenProvider.IsSupported,
                granted,
                lastError);
        }

        private void ThrowIfDisposed()
        {
            if (disposed)
            {
                throw new ObjectDisposedException(
                    "HabitHeroNotificationSettingsController");
            }
        }
    }
}
