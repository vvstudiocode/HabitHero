using System;
using System.Collections.Generic;

namespace HabitHero.Platform
{
    public enum AuthIntent
    {
        None,
        Login,
        PasswordRecovery,
    }

    public sealed class AuthCallbackPayload
    {
        public string AccessToken { get; internal set; }

        public string RefreshToken { get; internal set; }

        public string Code { get; internal set; }

        public string Type { get; internal set; }

        public string Error { get; internal set; }

        public string ErrorCode { get; internal set; }

        public string ErrorDescription { get; internal set; }

        public bool HasSessionPayload
        {
            get
            {
                return (!string.IsNullOrEmpty(AccessToken) && !string.IsNullOrEmpty(RefreshToken))
                    || !string.IsNullOrEmpty(Code);
            }
        }
    }

    public static class AuthCallbackParser
    {
        public const string AppUrlScheme = "com.vvstudiocode.habithero";

        public static AuthCallbackPayload Parse(string rawUrl)
        {
            AuthCallbackPayload empty = new AuthCallbackPayload();
            Uri url;
            if (!Uri.TryCreate(rawUrl, UriKind.Absolute, out url)) return empty;

            Dictionary<string, string> query = ParseParameters(url.Query);
            Dictionary<string, string> fragment = ParseParameters(url.Fragment);

            return new AuthCallbackPayload
            {
                AccessToken = GetValue(query, fragment, "access_token"),
                RefreshToken = GetValue(query, fragment, "refresh_token"),
                Code = GetValue(query, fragment, "code"),
                Type = GetValue(query, fragment, "type"),
                Error = GetValue(query, fragment, "error"),
                ErrorCode = GetValue(query, fragment, "error_code"),
                ErrorDescription = GetValue(query, fragment, "error_description"),
            };
        }

        public static AuthIntent GetIntent(string rawUrl)
        {
            Uri url;
            if (!Uri.TryCreate(rawUrl, UriKind.Absolute, out url)) return AuthIntent.None;

            string route = GetRoute(url);
            AuthCallbackPayload payload = Parse(rawUrl);

            if (string.Equals(url.Scheme, AppUrlScheme, StringComparison.OrdinalIgnoreCase))
            {
                if (route == "reset-password") return AuthIntent.PasswordRecovery;
                if (route == "login") return AuthIntent.Login;
                return AuthIntent.None;
            }

            if (route == "reset-password"
                || string.Equals(payload.Type, "recovery", StringComparison.OrdinalIgnoreCase))
            {
                return AuthIntent.PasswordRecovery;
            }

            return AuthIntent.None;
        }

        private static string GetRoute(Uri url)
        {
            string route = string.Equals(url.Scheme, AppUrlScheme, StringComparison.OrdinalIgnoreCase)
                ? (string.IsNullOrEmpty(url.Host) ? url.AbsolutePath : url.Host)
                : url.AbsolutePath;

            return (route ?? string.Empty).Trim('/').ToLowerInvariant();
        }

        private static string GetValue(
            Dictionary<string, string> query,
            Dictionary<string, string> fragment,
            string name)
        {
            string value;
            if (query.TryGetValue(name, out value)) return value;
            return fragment.TryGetValue(name, out value) ? value : null;
        }

        private static Dictionary<string, string> ParseParameters(string rawParameters)
        {
            Dictionary<string, string> values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrEmpty(rawParameters)) return values;

            string parameters = rawParameters.TrimStart('?', '#');
            string[] pairs = parameters.Split('&');
            foreach (string pair in pairs)
            {
                if (string.IsNullOrEmpty(pair)) continue;

                int separator = pair.IndexOf('=');
                string rawName = separator >= 0 ? pair.Substring(0, separator) : pair;
                string rawValue = separator >= 0 ? pair.Substring(separator + 1) : string.Empty;
                string name = Decode(rawName);
                if (string.IsNullOrEmpty(name) || values.ContainsKey(name)) continue;
                values[name] = Decode(rawValue);
            }

            return values;
        }

        private static string Decode(string value)
        {
            return Uri.UnescapeDataString((value ?? string.Empty).Replace('+', ' '));
        }
    }
}
