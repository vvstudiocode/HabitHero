#if UNITY_EDITOR
using UnityEditor;
using Unity.Notifications;
using Unity.Notifications.iOS;

namespace HabitHero.Editor
{
    [InitializeOnLoad]
    internal static class HabitHeroMobileNotificationSettings
    {
        static HabitHeroMobileNotificationSettings()
        {
            Configure();
        }

        [MenuItem("HabitHero/Configure Mobile Notifications")]
        private static void Configure()
        {
            NotificationSettings.iOSSettings.AddRemoteNotificationCapability = true;
            NotificationSettings.iOSSettings.RequestAuthorizationOnAppLaunch = false;
            NotificationSettings.iOSSettings.NotificationRequestAuthorizationForRemoteNotificationsOnAppLaunch = false;
            NotificationSettings.iOSSettings.RemoteNotificationForegroundPresentationOptions =
                PresentationOption.Alert | PresentationOption.Sound;
        }
    }
}
#endif
