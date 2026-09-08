using System;
using System.IO;
using HabitHero.Platform;
using UnityEditor;
using UnityEngine;

namespace HabitHero.Editor
{
    public static class ConfigureSupabaseRuntime
    {
        private const string AssetPath = "Assets/Resources/SupabaseRuntimeConfig.asset";

        [MenuItem("HabitHero/Configure Supabase Runtime")]
        public static void Apply()
        {
            string url = Environment.GetEnvironmentVariable("VITE_SUPABASE_URL");
            string key = Environment.GetEnvironmentVariable("VITE_SUPABASE_PUBLISHABLE_KEY");
            if (string.IsNullOrWhiteSpace(url) || string.IsNullOrWhiteSpace(key))
            {
                Debug.LogError(
                    "Supabase runtime configuration needs VITE_SUPABASE_URL and " +
                    "VITE_SUPABASE_PUBLISHABLE_KEY in the Unity process environment.");
                return;
            }

            SupabaseClientSettings settings;
            string error;
            if (!SupabaseClientSettings.TryCreate(url, key, out settings, out error))
            {
                Debug.LogError("Supabase runtime configuration is invalid: " + error);
                return;
            }

            string resourcesDirectory = Path.Combine(Application.dataPath, "Resources");
            if (!Directory.Exists(resourcesDirectory))
            {
                Directory.CreateDirectory(resourcesDirectory);
            }

            SupabaseRuntimeConfig config = AssetDatabase.LoadAssetAtPath<SupabaseRuntimeConfig>(
                AssetPath);
            if (config == null)
            {
                config = ScriptableObject.CreateInstance<SupabaseRuntimeConfig>();
                AssetDatabase.CreateAsset(config, AssetPath);
            }

            config.SetPublicClient(settings.Url, settings.PublishableKey);
            EditorUtility.SetDirty(config);
            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log("Supabase runtime configuration created locally without logging the key.");
        }
    }
}
