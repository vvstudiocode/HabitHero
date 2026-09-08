using UnityEngine;

namespace HabitHero.Platform
{
    [CreateAssetMenu(
        fileName = "SupabaseRuntimeConfig",
        menuName = "HabitHero/Supabase Runtime Config")]
    public sealed class SupabaseRuntimeConfig : ScriptableObject
    {
        [SerializeField] private string supabaseUrl;
        [SerializeField] private string publishableKey;
        [SerializeField] private string gameAssetBaseUrl;

        public string SupabaseUrl
        {
            get { return supabaseUrl; }
        }

        public string PublishableKey
        {
            get { return publishableKey; }
        }

        public string GameAssetBaseUrl
        {
            get { return gameAssetBaseUrl; }
        }

        public bool TryCreateSettings(
            out SupabaseClientSettings settings,
            out string error)
        {
            return SupabaseClientSettings.TryCreate(
                supabaseUrl,
                publishableKey,
                out settings,
                out error);
        }

        public void SetPublicClient(string url, string key)
        {
            supabaseUrl = url == null ? string.Empty : url.Trim();
            publishableKey = key == null ? string.Empty : key.Trim();
        }

        public void SetGameAssetBaseUrl(string value)
        {
            gameAssetBaseUrl = value == null ? string.Empty : value.Trim();
        }
    }
}
