using System;
using UnityEngine;

namespace HabitHero.Platform
{
    public enum HabitHeroWorldTimePhase
    {
        Dawn,
        Day,
        Dusk,
        Night,
    }

    public enum HabitHeroWorldWeatherCondition
    {
        Clear,
        Cloudy,
        Rain,
        Storm,
    }

    [Serializable]
    public sealed class SupabaseWorldWeatherRecord
    {
        public string condition;
        public float intensity;
        public float cloudCover;
        public float windSpeedKmh;
        public string source;
        public long observedAt;
    }

    public static class HabitHeroWorldWeather
    {
        public static HabitHeroWorldTimePhase GetTimePhase(int hour, int minute)
        {
            int safeHour = Mathf.Clamp(hour, 0, 23);
            int safeMinute = Mathf.Clamp(minute, 0, 59);
            int totalMinutes = safeHour * 60 + safeMinute;
            if (totalMinutes >= 5 * 60 && totalMinutes < 7 * 60)
            {
                return HabitHeroWorldTimePhase.Dawn;
            }

            if (totalMinutes >= 7 * 60 && totalMinutes < 17 * 60)
            {
                return HabitHeroWorldTimePhase.Day;
            }

            if (totalMinutes >= 17 * 60 && totalMinutes < 18 * 60 + 30)
            {
                return HabitHeroWorldTimePhase.Dusk;
            }

            return HabitHeroWorldTimePhase.Night;
        }

        public static HabitHeroWorldWeatherCondition ParseCondition(string value)
        {
            if (string.Equals(value, "cloudy", StringComparison.OrdinalIgnoreCase))
            {
                return HabitHeroWorldWeatherCondition.Cloudy;
            }

            if (string.Equals(value, "rain", StringComparison.OrdinalIgnoreCase))
            {
                return HabitHeroWorldWeatherCondition.Rain;
            }

            if (string.Equals(value, "storm", StringComparison.OrdinalIgnoreCase))
            {
                return HabitHeroWorldWeatherCondition.Storm;
            }

            return HabitHeroWorldWeatherCondition.Clear;
        }

        public static float GetWeatherLightFactor(
            HabitHeroWorldWeatherCondition condition)
        {
            return condition == HabitHeroWorldWeatherCondition.Cloudy
                || condition == HabitHeroWorldWeatherCondition.Storm
                ? 0.72f
                : 1f;
        }

        public static float GetRainRate(
            HabitHeroWorldWeatherCondition condition)
        {
            switch (condition)
            {
                case HabitHeroWorldWeatherCondition.Storm:
                    return 1f;
                case HabitHeroWorldWeatherCondition.Rain:
                    return 0.65f;
                default:
                    return 0f;
            }
        }

        public static SupabaseWorldWeatherRecord CreateFallback()
        {
            return new SupabaseWorldWeatherRecord
            {
                condition = "clear",
                intensity = 0f,
                cloudCover = 0f,
                windSpeedKmh = 0f,
                source = "fallback",
                observedAt = 0,
            };
        }

        public static SupabaseWorldWeatherRecord Normalize(
            SupabaseWorldWeatherRecord value)
        {
            SupabaseWorldWeatherRecord source = value ?? CreateFallback();
            HabitHeroWorldWeatherCondition condition = ParseCondition(source.condition);
            return new SupabaseWorldWeatherRecord
            {
                condition = ConditionToString(condition),
                intensity = Mathf.Clamp01(
                    IsFinite(source.intensity) ? source.intensity : 0f),
                cloudCover = Mathf.Clamp(
                    IsFinite(source.cloudCover) ? source.cloudCover : 0f,
                    0f,
                    100f),
                windSpeedKmh = Mathf.Max(
                    0f,
                    IsFinite(source.windSpeedKmh) ? source.windSpeedKmh : 0f),
                source = string.IsNullOrWhiteSpace(source.source)
                    ? "fallback"
                    : source.source,
                observedAt = source.observedAt,
            };
        }

        private static string ConditionToString(
            HabitHeroWorldWeatherCondition condition)
        {
            switch (condition)
            {
                case HabitHeroWorldWeatherCondition.Cloudy:
                    return "cloudy";
                case HabitHeroWorldWeatherCondition.Rain:
                    return "rain";
                case HabitHeroWorldWeatherCondition.Storm:
                    return "storm";
                default:
                    return "clear";
            }
        }

        private static bool IsFinite(float value)
        {
            return !float.IsNaN(value) && !float.IsInfinity(value);
        }
    }
}
