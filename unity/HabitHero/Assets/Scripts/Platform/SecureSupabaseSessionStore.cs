using System;
using System.Text;
using UnityEngine;

#if UNITY_IOS && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

namespace HabitHero.Platform
{
    public sealed class SecureSupabaseSessionStore : ISupabaseSessionStore
    {
        private const string SessionKey = "HabitHero.Supabase.Session.v1";
        private const int NativeBufferLength = 16384;

        private readonly PlayerPrefsSupabaseSessionStore editorFallback =
            new PlayerPrefsSupabaseSessionStore();

        public string Load()
        {
#if UNITY_IOS && !UNITY_EDITOR
            StringBuilder buffer = new StringBuilder(NativeBufferLength);
            return HabitHeroSecureStorageGet(SessionKey, buffer, buffer.Capacity)
                ? buffer.ToString()
                : null;
#elif UNITY_ANDROID && !UNITY_EDITOR
            return AndroidLoad();
#else
            return editorFallback.Load();
#endif
        }

        public void Save(string serializedSession)
        {
#if UNITY_IOS && !UNITY_EDITOR
            if (!HabitHeroSecureStorageSet(SessionKey, serializedSession ?? string.Empty))
            {
                throw new InvalidOperationException("iOS Keychain could not save the Supabase session.");
            }
#elif UNITY_ANDROID && !UNITY_EDITOR
            if (!AndroidSave(serializedSession ?? string.Empty))
            {
                throw new InvalidOperationException("Android Keystore could not save the Supabase session.");
            }
#else
            editorFallback.Save(serializedSession);
#endif
        }

        public void Clear()
        {
#if UNITY_IOS && !UNITY_EDITOR
            if (!HabitHeroSecureStorageClear(SessionKey))
            {
                throw new InvalidOperationException("iOS Keychain could not clear the Supabase session.");
            }
#elif UNITY_ANDROID && !UNITY_EDITOR
            if (!AndroidClear())
            {
                throw new InvalidOperationException("Android Keystore could not clear the Supabase session.");
            }
#else
            editorFallback.Clear();
#endif
        }

#if UNITY_IOS && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern bool HabitHeroSecureStorageGet(
            string key,
            StringBuilder buffer,
            int bufferLength);

        [DllImport("__Internal")]
        private static extern bool HabitHeroSecureStorageSet(string key, string value);

        [DllImport("__Internal")]
        private static extern bool HabitHeroSecureStorageClear(string key);
#endif

#if UNITY_ANDROID && !UNITY_EDITOR
        private static string AndroidLoad()
        {
            try
            {
                using (AndroidJavaObject activity = GetCurrentActivity())
                using (AndroidJavaClass storage = new AndroidJavaClass(
                    "com.vvstudiocode.habithero.HabitHeroSecureStorage"))
                {
                    return storage.CallStatic<string>("load", activity, SessionKey);
                }
            }
            catch (Exception exception)
            {
                Debug.LogError("HabitHero secure session load failed: " + exception.Message);
                return null;
            }
        }

        private static bool AndroidSave(string value)
        {
            try
            {
                using (AndroidJavaObject activity = GetCurrentActivity())
                using (AndroidJavaClass storage = new AndroidJavaClass(
                    "com.vvstudiocode.habithero.HabitHeroSecureStorage"))
                {
                    return storage.CallStatic<bool>("save", activity, SessionKey, value);
                }
            }
            catch (Exception exception)
            {
                Debug.LogError("HabitHero secure session save failed: " + exception.Message);
                return false;
            }
        }

        private static bool AndroidClear()
        {
            try
            {
                using (AndroidJavaObject activity = GetCurrentActivity())
                using (AndroidJavaClass storage = new AndroidJavaClass(
                    "com.vvstudiocode.habithero.HabitHeroSecureStorage"))
                {
                    return storage.CallStatic<bool>("clear", activity, SessionKey);
                }
            }
            catch (Exception exception)
            {
                Debug.LogError("HabitHero secure session clear failed: " + exception.Message);
                return false;
            }
        }

        private static AndroidJavaObject GetCurrentActivity()
        {
            using (AndroidJavaClass unityPlayer = new AndroidJavaClass(
                "com.unity3d.player.UnityPlayer"))
            {
                return unityPlayer.GetStatic<AndroidJavaObject>("currentActivity");
            }
        }
#endif
    }
}
