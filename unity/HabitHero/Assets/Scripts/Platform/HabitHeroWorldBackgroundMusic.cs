using System;
using UnityEngine;

namespace HabitHero.App
{
    public sealed class HabitHeroWorldBackgroundMusicConfig
    {
        public HabitHeroWorldBackgroundMusicConfig(
            string assetPath,
            float volume,
            float fadeDurationSeconds)
        {
            AssetPath = assetPath;
            Volume = volume;
            FadeDurationSeconds = fadeDurationSeconds;
        }

        public string AssetPath { get; private set; }
        public float Volume { get; private set; }
        public float FadeDurationSeconds { get; private set; }
    }

    public static class HabitHeroWorldBackgroundMusic
    {
        public const float DefaultVolume = 0.24f;
        public const float DefaultFadeDurationSeconds = 2f;
        public const float CloudFadeDurationSeconds = 4f;

        private const string PreferencePrefix = "habithero.background-music:";
        private const string DefaultAssetPath =
            "/audio/faespencer-monday-marimba-194523.mp3";

        public static HabitHeroWorldBackgroundMusicConfig GetConfig(string sceneId)
        {
            string assetPath = DefaultAssetPath;
            float fadeDurationSeconds = DefaultFadeDurationSeconds;
            switch (sceneId ?? string.Empty)
            {
                case "sunrise-village":
                    assetPath = "/audio/sunrise-village-music.mp3";
                    break;
                case "forest-valley":
                    assetPath = "/audio/forest-valley-senyu-music.mp3";
                    break;
                case "cloud-workshop":
                    assetPath = "/audio/cloud-workshop-music.mp3";
                    fadeDurationSeconds = CloudFadeDurationSeconds;
                    break;
                case "tideglow-archipelago":
                    assetPath = "/audio/tideglow-archipelago-music.mp3";
                    break;
                case "star-sand-wasteland":
                    assetPath = "/audio/star-sand-music.mp3";
                    break;
            }

            return new HabitHeroWorldBackgroundMusicConfig(
                assetPath,
                DefaultVolume,
                fadeDurationSeconds);
        }

        public static string BuildUrl(string baseUrl, string sceneId)
        {
            if (string.IsNullOrWhiteSpace(baseUrl)) return string.Empty;
            HabitHeroWorldBackgroundMusicConfig config = GetConfig(sceneId);
            return baseUrl.TrimEnd('/') + config.AssetPath;
        }

        public static string GetPreferenceKey(string childProfileId)
        {
            return PreferencePrefix + (childProfileId ?? string.Empty).Trim();
        }

        public static bool GetEnabled(string childProfileId)
        {
            if (string.IsNullOrWhiteSpace(childProfileId)) return true;
            return PlayerPrefs.GetInt(GetPreferenceKey(childProfileId), 1) != 0;
        }

        public static void SetEnabled(string childProfileId, bool enabled)
        {
            if (string.IsNullOrWhiteSpace(childProfileId)) return;
            PlayerPrefs.SetInt(GetPreferenceKey(childProfileId), enabled ? 1 : 0);
            PlayerPrefs.Save();
        }
    }
}
