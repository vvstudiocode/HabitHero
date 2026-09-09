using UnityEngine;

namespace HabitHero.App
{
    public static class HabitHeroChildDisplayPreferences
    {
        private const string ShowPetNamesPrefix =
            "habithero.child-show-pet-names:";
        private const string DayNightPrefix =
            "habithero.child-day-night:";

        public static bool GetShowPetNames(string childProfileId)
        {
            return GetBoolean(ShowPetNamesPrefix, childProfileId, true);
        }

        public static void SetShowPetNames(string childProfileId, bool enabled)
        {
            SetBoolean(ShowPetNamesPrefix, childProfileId, enabled);
        }

        public static bool GetDayNightEnabled(string childProfileId)
        {
            return GetBoolean(DayNightPrefix, childProfileId, true);
        }

        public static void SetDayNightEnabled(string childProfileId, bool enabled)
        {
            SetBoolean(DayNightPrefix, childProfileId, enabled);
        }

        private static bool GetBoolean(
            string prefix,
            string childProfileId,
            bool defaultValue)
        {
            if (string.IsNullOrWhiteSpace(childProfileId)) return defaultValue;
            return PlayerPrefs.GetInt(
                prefix + childProfileId.Trim(),
                defaultValue ? 1 : 0) != 0;
        }

        private static void SetBoolean(
            string prefix,
            string childProfileId,
            bool enabled)
        {
            if (string.IsNullOrWhiteSpace(childProfileId)) return;
            PlayerPrefs.SetInt(
                prefix + childProfileId.Trim(),
                enabled ? 1 : 0);
            PlayerPrefs.Save();
        }
    }
}
