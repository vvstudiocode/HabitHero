using System;
using System.Globalization;
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

        public static HabitHeroWorldWeatherCondition MapOpenMeteoWeatherCode(
            int weatherCode,
            float precipitation = 0f)
        {
            switch (weatherCode)
            {
                case 95:
                case 96:
                case 99:
                case 65:
                case 67:
                case 82:
                    return HabitHeroWorldWeatherCondition.Storm;
                case 51:
                case 53:
                case 55:
                case 56:
                case 57:
                case 61:
                case 63:
                case 66:
                case 80:
                case 81:
                    return HabitHeroWorldWeatherCondition.Rain;
                case 1:
                case 2:
                case 3:
                case 45:
                case 48:
                case 71:
                case 73:
                case 75:
                case 77:
                case 85:
                case 86:
                    return HabitHeroWorldWeatherCondition.Cloudy;
                default:
                    return precipitation > 0f
                        ? HabitHeroWorldWeatherCondition.Rain
                        : HabitHeroWorldWeatherCondition.Clear;
            }
        }

        public static SupabaseWorldWeatherRecord ParseOpenMeteoResponse(
            string json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                throw new FormatException(
                    "Open-Meteo response was empty.");
            }

            OpenMeteoPayload payload;
            try
            {
                payload = JsonUtility.FromJson<OpenMeteoPayload>(json);
            }
            catch (Exception exception)
            {
                throw new FormatException(
                    "Open-Meteo response was invalid.",
                    exception);
            }

            if (payload == null || payload.current == null)
            {
                throw new FormatException(
                    "Open-Meteo response did not contain current weather.");
            }

            OpenMeteoCurrent current = payload.current;
            float precipitation = Mathf.Max(0f, current.precipitation);
            float rain = Mathf.Max(0f, current.rain);
            float showers = Mathf.Max(0f, current.showers);
            float cloudCover = Mathf.Clamp(current.cloud_cover, 0f, 100f);
            HabitHeroWorldWeatherCondition condition = MapOpenMeteoWeatherCode(
                current.weather_code,
                precipitation + rain + showers);
            long observedAt = 0;
            DateTimeOffset observedTime;
            if (DateTimeOffset.TryParse(
                    current.time,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                    out observedTime))
            {
                observedAt = observedTime.ToUnixTimeMilliseconds();
            }

            return Normalize(new SupabaseWorldWeatherRecord
            {
                condition = ConditionToString(condition),
                intensity = GetWeatherIntensity(
                    condition,
                    precipitation + rain,
                    showers,
                    cloudCover),
                cloudCover = cloudCover,
                windSpeedKmh = Mathf.Max(0f, current.wind_speed_10m),
                source = "open-meteo",
                observedAt = observedAt,
            });
        }

        public static string BuildOpenMeteoUrl()
        {
            return "https://api.open-meteo.com/v1/forecast"
                + "?latitude=25.033&longitude=121.565"
                + "&current=weather_code%2Cprecipitation%2Crain%2Cshowers"
                + "%2Ccloud_cover%2Cwind_speed_10m&timezone=auto";
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

        private static float GetWeatherIntensity(
            HabitHeroWorldWeatherCondition condition,
            float precipitation,
            float showers,
            float cloudCover)
        {
            if (condition == HabitHeroWorldWeatherCondition.Clear) return 0f;
            if (condition == HabitHeroWorldWeatherCondition.Cloudy)
            {
                return Mathf.Clamp(cloudCover / 100f, 0.18f, 0.72f);
            }

            float precipitationIntensity = Mathf.Clamp(
                Mathf.Max(precipitation, showers) / 4f,
                0.25f,
                1f);
            return condition == HabitHeroWorldWeatherCondition.Storm
                ? Mathf.Max(0.72f, precipitationIntensity)
                : precipitationIntensity;
        }

        [Serializable]
        private sealed class OpenMeteoPayload
        {
            public OpenMeteoCurrent current;
        }

        [Serializable]
        private sealed class OpenMeteoCurrent
        {
            public int weather_code;
            public float precipitation;
            public float rain;
            public float showers;
            public float cloud_cover;
            public float wind_speed_10m;
            public string time;
        }

        private static bool IsFinite(float value)
        {
            return !float.IsNaN(value) && !float.IsInfinity(value);
        }
    }
}
