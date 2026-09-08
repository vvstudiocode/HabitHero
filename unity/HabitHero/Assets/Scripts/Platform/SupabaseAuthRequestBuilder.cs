using System;
using System.Collections.Generic;
using System.Text;

namespace HabitHero.Platform
{
    public static class SupabaseAuthRequestBuilder
    {
        public static bool TryBuildPasswordGrant(
            SupabaseClientSettings settings,
            string email,
            string password,
            out SupabaseRequestContract request,
            out string error)
        {
            if (!ValidateCredential(email, password, out error))
            {
                request = null;
                return false;
            }

            return TryBuildAuthRequest(
                settings,
                "POST",
                "/auth/v1/token?grant_type=password",
                "{\"email\":\"" + EscapeJson(email.Trim())
                    + "\",\"password\":\"" + EscapeJson(password) + "\"}",
                null,
                out request,
                out error);
        }

        public static bool TryBuildSignUp(
            SupabaseClientSettings settings,
            string email,
            string password,
            out SupabaseRequestContract request,
            out string error)
        {
            if (!ValidateCredential(email, password, out error))
            {
                request = null;
                return false;
            }

            return TryBuildAuthRequest(
                settings,
                "POST",
                "/auth/v1/signup",
                "{\"email\":\"" + EscapeJson(email.Trim())
                    + "\",\"password\":\"" + EscapeJson(password) + "\"}",
                null,
                out request,
                out error);
        }

        public static bool TryBuildRefreshGrant(
            SupabaseClientSettings settings,
            string refreshToken,
            out SupabaseRequestContract request,
            out string error)
        {
            if (string.IsNullOrWhiteSpace(refreshToken))
            {
                request = null;
                error = "Supabase refresh token is missing.";
                return false;
            }

            return TryBuildAuthRequest(
                settings,
                "POST",
                "/auth/v1/token?grant_type=refresh_token",
                "{\"refresh_token\":\"" + EscapeJson(refreshToken.Trim()) + "\"}",
                null,
                out request,
                out error);
        }

        public static bool TryBuildUser(
            SupabaseClientSettings settings,
            string accessToken,
            out SupabaseRequestContract request,
            out string error)
        {
            return TryBuildAuthRequest(
                settings,
                "GET",
                "/auth/v1/user",
                string.Empty,
                accessToken,
                out request,
                out error);
        }

        public static bool TryBuildPasswordRecovery(
            SupabaseClientSettings settings,
            string email,
            string redirectTo,
            out SupabaseRequestContract request,
            out string error)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                request = null;
                error = "Supabase recovery email is missing.";
                return false;
            }

            string body = "{\"email\":\"" + EscapeJson(email.Trim()) + "\"";
            if (!string.IsNullOrWhiteSpace(redirectTo))
            {
                body += ",\"redirect_to\":\"" + EscapeJson(redirectTo.Trim()) + "\"";
            }

            body += "}";
            return TryBuildAuthRequest(
                settings,
                "POST",
                "/auth/v1/recover",
                body,
                null,
                out request,
                out error);
        }

        public static bool TryBuildUpdatePassword(
            SupabaseClientSettings settings,
            string accessToken,
            string password,
            out SupabaseRequestContract request,
            out string error)
        {
            if (string.IsNullOrWhiteSpace(password))
            {
                request = null;
                error = "Supabase password is missing.";
                return false;
            }

            return TryBuildAuthRequest(
                settings,
                "PUT",
                "/auth/v1/user",
                "{\"password\":\"" + EscapeJson(password) + "\"}",
                accessToken,
                out request,
                out error);
        }

        public static bool TryBuildLogout(
            SupabaseClientSettings settings,
            string accessToken,
            out SupabaseRequestContract request,
            out string error)
        {
            return TryBuildAuthRequest(
                settings,
                "POST",
                "/auth/v1/logout",
                string.Empty,
                accessToken,
                out request,
                out error);
        }

        private static bool TryBuildAuthRequest(
            SupabaseClientSettings settings,
            string method,
            string path,
            string body,
            string accessToken,
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

            if ((path == "/auth/v1/user" || path == "/auth/v1/logout")
                && string.IsNullOrWhiteSpace(accessToken))
            {
                error = "An access token is required for this Supabase auth request.";
                return false;
            }

            Dictionary<string, string> headers = new Dictionary<string, string>
            {
                { "apikey", settings.PublishableKey },
                { "Accept", "application/json" },
            };

            if (!string.IsNullOrEmpty(body)) headers["Content-Type"] = "application/json";
            if (!string.IsNullOrWhiteSpace(accessToken)) headers["Authorization"] = "Bearer " + accessToken.Trim();

            request = new SupabaseRequestContract(
                method,
                settings.Url + path,
                headers,
                body ?? string.Empty);
            return true;
        }

        private static bool ValidateCredential(string email, string password, out string error)
        {
            if (string.IsNullOrWhiteSpace(email))
            {
                error = "Supabase email is missing.";
                return false;
            }

            if (string.IsNullOrEmpty(password))
            {
                error = "Supabase password is missing.";
                return false;
            }

            error = null;
            return true;
        }

        private static string EscapeJson(string value)
        {
            StringBuilder builder = new StringBuilder(value.Length + 8);
            foreach (char character in value)
            {
                switch (character)
                {
                    case '\\': builder.Append("\\\\"); break;
                    case '"': builder.Append("\\\""); break;
                    case '\b': builder.Append("\\b"); break;
                    case '\f': builder.Append("\\f"); break;
                    case '\n': builder.Append("\\n"); break;
                    case '\r': builder.Append("\\r"); break;
                    case '\t': builder.Append("\\t"); break;
                    default:
                        if (character < 32) builder.Append("\\u").Append(((int)character).ToString("x4"));
                        else builder.Append(character);
                        break;
                }
            }

            return builder.ToString();
        }
    }
}
