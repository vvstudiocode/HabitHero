using System.Collections.Generic;
using System.Text.RegularExpressions;

namespace HabitHero.Platform
{
    public sealed class SupabaseRequestContract
    {
        public string Method { get; private set; }

        public string Url { get; private set; }

        public Dictionary<string, string> Headers { get; private set; }

        public string Body { get; private set; }

        internal SupabaseRequestContract(
            string method,
            string url,
            Dictionary<string, string> headers,
            string body)
        {
            Method = method;
            Url = url;
            Headers = headers;
            Body = body;
        }
    }

    public static class SupabaseRequestBuilder
    {
        private static readonly Regex SafeFunctionName = new Regex(
            "^[a-z][a-z0-9_]*$",
            RegexOptions.CultureInvariant);

        public static bool TryBuildRpc(
            SupabaseClientSettings settings,
            string functionName,
            string accessToken,
            string jsonBody,
            out SupabaseRequestContract request,
            out string error)
        {
            request = null;
            error = null;

            if (settings == null)
            {
                error = "Supabase client settings are missing.";
                return false;
            }

            if (string.IsNullOrEmpty(functionName) || !SafeFunctionName.IsMatch(functionName))
            {
                error = "Supabase RPC function name is invalid.";
                return false;
            }

            Dictionary<string, string> headers = new Dictionary<string, string>
            {
                { "apikey", settings.PublishableKey },
                { "Content-Type", "application/json" },
                { "Accept", "application/json" },
            };

            if (!string.IsNullOrEmpty(accessToken))
            {
                headers["Authorization"] = "Bearer " + accessToken;
            }

            request = new SupabaseRequestContract(
                "POST",
                settings.Url + "/rest/v1/rpc/" + functionName,
                headers,
                string.IsNullOrEmpty(jsonBody) ? "{}" : jsonBody);
            return true;
        }
    }
}
