using UnityEngine;

namespace HabitHero.Platform
{
    public sealed class PlayerPrefsSupabaseSessionStore : ISupabaseSessionStore
    {
        private const string SessionKey = "HabitHero.Supabase.Session.v1";

        public string Load()
        {
            return PlayerPrefs.GetString(SessionKey, string.Empty);
        }

        public void Save(string serializedSession)
        {
            PlayerPrefs.SetString(SessionKey, serializedSession ?? string.Empty);
            PlayerPrefs.Save();
        }

        public void Clear()
        {
            PlayerPrefs.DeleteKey(SessionKey);
            PlayerPrefs.Save();
        }
    }
}
