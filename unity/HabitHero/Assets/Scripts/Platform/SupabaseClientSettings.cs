using System;

namespace HabitHero.Platform
{
    public sealed class SupabaseClientSettings
    {
        private SupabaseClientSettings(string url, string publishableKey)
        {
            Url = url;
            PublishableKey = publishableKey;
        }

        public string Url { get; private set; }

        public string PublishableKey { get; private set; }

        public static bool TryCreate(
            string rawUrl,
            string rawPublishableKey,
            out SupabaseClientSettings settings,
            out string error)
        {
            settings = null;
            error = null;

            string url = rawUrl == null ? string.Empty : rawUrl.Trim();
            string publishableKey = rawPublishableKey == null ? string.Empty : rawPublishableKey.Trim();

            Uri parsedUrl;
            if (!Uri.TryCreate(url, UriKind.Absolute, out parsedUrl)
                || (parsedUrl.Scheme != Uri.UriSchemeHttp && parsedUrl.Scheme != Uri.UriSchemeHttps))
            {
                error = "Supabase URL must use http or https.";
                return false;
            }

            if (string.IsNullOrWhiteSpace(publishableKey))
            {
                error = "Supabase publishable key is missing.";
                return false;
            }

            string normalizedKey = publishableKey.ToLowerInvariant();
            if (normalizedKey.Contains("service_role")
                || normalizedKey.Contains("secret")
                || normalizedKey.Contains("paste_")
                || normalizedKey.Contains("placeholder"))
            {
                error = "A server secret cannot be used by the Unity client.";
                return false;
            }

            settings = new SupabaseClientSettings(
                parsedUrl.ToString().TrimEnd('/'),
                publishableKey);
            return true;
        }
    }
}
