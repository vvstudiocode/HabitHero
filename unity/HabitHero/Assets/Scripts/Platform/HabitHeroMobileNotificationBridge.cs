using System;
using System.Collections;
using UnityEngine;

#if (UNITY_IOS || UNITY_ANDROID) && !UNITY_EDITOR
using Unity.Notifications;
#if UNITY_IOS
using Unity.Notifications.iOS;
#endif
#endif

namespace HabitHero.App
{
    public sealed class HabitHeroMobileNotificationBridge : IDisposable
    {
        private readonly MonoBehaviour host;
        private readonly Action<HabitHeroNotificationTarget> onTarget;
        private readonly System.Collections.Generic.HashSet<string> handledSignatures =
            new System.Collections.Generic.HashSet<string>(StringComparer.Ordinal);
        private Coroutine queryCoroutine;
#if UNITY_ANDROID && !UNITY_EDITOR
        private Coroutine androidLaunchCoroutine;
#endif
        private bool initialized;
        private bool disposed;

        public HabitHeroMobileNotificationBridge(
            MonoBehaviour host,
            Action<HabitHeroNotificationTarget> onTarget)
        {
            if (host == null) throw new ArgumentNullException("host");
            if (onTarget == null) throw new ArgumentNullException("onTarget");
            this.host = host;
            this.onTarget = onTarget;
        }

        public void Start()
        {
#if (UNITY_IOS || UNITY_ANDROID) && !UNITY_EDITOR
            if (disposed || initialized) return;

            try
            {
                NotificationCenterArgs args = NotificationCenterArgs.Default;
                args.PresentationOptions = NotificationPresentation.Alert
                    | NotificationPresentation.Badge
                    | NotificationPresentation.Sound;
                args.AndroidChannelId = "habithero-default";
                args.AndroidChannelName = "HabitHero";
                args.AndroidChannelDescription = "HabitHero 任務與冒險通知";
                NotificationCenter.Initialize(args);
                NotificationCenter.OnNotificationReceived += HandleNotificationReceived;
                initialized = true;
                queryCoroutine = host.StartCoroutine(ObserveTappedNotifications());
#if UNITY_ANDROID
                androidLaunchCoroutine = host.StartCoroutine(ObserveAndroidLaunchPayload());
#endif
            }
            catch (Exception exception)
            {
                Debug.LogWarning(
                    "HabitHero notification bridge could not initialize: "
                    + exception.Message);
            }
#endif
        }

        public void Dispose()
        {
            if (disposed) return;
            disposed = true;
#if (UNITY_IOS || UNITY_ANDROID) && !UNITY_EDITOR
            if (queryCoroutine != null)
            {
                host.StopCoroutine(queryCoroutine);
                queryCoroutine = null;
            }
#if UNITY_ANDROID && !UNITY_EDITOR
            if (androidLaunchCoroutine != null)
            {
                host.StopCoroutine(androidLaunchCoroutine);
                androidLaunchCoroutine = null;
            }
#endif

            if (initialized)
            {
                NotificationCenter.OnNotificationReceived -= HandleNotificationReceived;
            }
#endif
            initialized = false;
            handledSignatures.Clear();
        }

#if (UNITY_IOS || UNITY_ANDROID) && !UNITY_EDITOR
        private void HandleNotificationReceived(Notification notification)
        {
            SubmitNotification(notification);
        }

        private IEnumerator ObserveTappedNotifications()
        {
            yield return null;
            while (!disposed && initialized)
            {
                Unity.Notifications.QueryLastRespondedNotificationOp operation = null;
                try
                {
                    operation = NotificationCenter.QueryLastRespondedNotification();
                }
                catch (Exception exception)
                {
                    Debug.LogWarning(
                        "HabitHero notification tap query failed: "
                        + exception.Message);
                }

                if (operation != null)
                {
                    while (!disposed && operation.keepWaiting)
                    {
                        yield return null;
                    }

                    if (!disposed
                        && operation.State
                            == Unity.Notifications.QueryLastRespondedNotificationState
                                .HaveRespondedNotification)
                    {
                        try
                        {
                            SubmitNotification(operation.Notification);
                        }
                        catch (Exception exception)
                        {
                            Debug.LogWarning(
                                "HabitHero notification tap could not be read: "
                                + exception.Message);
                        }
                    }
                }

                yield return new WaitForSecondsRealtime(0.5f);
            }
        }

        private void SubmitNotification(Notification notification)
        {
            if (disposed) return;

            HabitHeroNotificationTarget target;
            string rawData = notification.Data;
            if (!HabitHeroNotificationPayload.TryParse(rawData, out target))
            {
#if UNITY_IOS
                iOSNotification iosNotification = (iOSNotification)notification;
                string taskId = null;
                string scheduleId = null;
                string eventName = null;
                if (iosNotification != null && iosNotification.UserInfo != null)
                {
                    iosNotification.UserInfo.TryGetValue("taskId", out taskId);
                    iosNotification.UserInfo.TryGetValue("scheduleId", out scheduleId);
                    iosNotification.UserInfo.TryGetValue("event", out eventName);
                }

                HabitHeroNotificationPayload.TryCreate(
                    taskId,
                    scheduleId,
                    eventName,
                    out target);
#endif
            }

            if (target == null) return;
            string signature = (notification.Identifier.HasValue
                    ? notification.Identifier.Value.ToString()
                    : string.Empty)
                + ":" + target.ReferenceId
                + ":" + target.Event;
            DispatchTarget(target, signature);
        }

#if UNITY_ANDROID && !UNITY_EDITOR
        private IEnumerator ObserveAndroidLaunchPayload()
        {
            yield return null;
            while (!disposed && initialized)
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
                        string rawData = bridge.CallStatic<string>(
                            "consumeLaunchPayload",
                            activity);
                        if (!string.IsNullOrWhiteSpace(rawData))
                        {
                            HabitHeroNotificationTarget target;
                            if (HabitHeroNotificationPayload.TryParse(rawData, out target)
                                && target != null)
                            {
                                DispatchTarget(target, "fcm:" + rawData);
                            }
                        }
                    }
                }
                catch (Exception exception)
                {
                    Debug.LogWarning(
                        "HabitHero Firebase notification launch payload could not be read: "
                        + exception.Message);
                }

                yield return new WaitForSecondsRealtime(0.5f);
            }
        }
#endif

        private void DispatchTarget(
            HabitHeroNotificationTarget target,
            string signature)
        {
            if (target == null || !handledSignatures.Add(signature)) return;

            try
            {
                NotificationCenter.ClearBadge();
            }
            catch (Exception exception)
            {
                Debug.LogWarning(
                    "HabitHero notification badge could not be cleared: "
                    + exception.Message);
            }

            onTarget(target);
        }
#endif
    }
}
