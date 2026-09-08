using System;
using UnityEngine;

namespace HabitHero.Platform
{
    [Serializable]
    public sealed class SupabaseAuthErrorResponse
    {
        public string error;
        public string error_code;
        public string error_description;
        public string message;
        public string msg;
    }

    public static class SupabaseAuthResponseParser
    {
        public static bool TryParseSession(
            string body,
            long nowUnixSeconds,
            out SupabaseSession session,
            out string error)
        {
            session = null;
            error = null;

            SupabaseAuthResponse response;
            if (!TryParse(body, out response, out error)) return false;
            return SupabaseSession.TryCreateFromAuthResponse(
                response,
                nowUnixSeconds,
                out session,
                out error);
        }

        public static bool TryParseUser(string body, out SupabaseUser user, out string error)
        {
            user = null;
            error = null;

            if (string.IsNullOrWhiteSpace(body))
            {
                error = "Supabase user response is empty.";
                return false;
            }

            try
            {
                user = JsonUtility.FromJson<SupabaseUser>(body);
            }
            catch (Exception exception)
            {
                error = "Supabase user response JSON is invalid: " + exception.Message;
                return false;
            }

            if (user == null || string.IsNullOrWhiteSpace(user.id))
            {
                user = null;
                error = "Supabase user response is incomplete.";
                return false;
            }

            return true;
        }

        public static string GetErrorMessage(string body, long statusCode)
        {
            if (!string.IsNullOrWhiteSpace(body))
            {
                try
                {
                    SupabaseAuthErrorResponse response = JsonUtility.FromJson<SupabaseAuthErrorResponse>(body);
                    string message = FirstNonEmpty(
                        response == null ? null : response.msg,
                        response == null ? null : response.message,
                        response == null ? null : response.error_description,
                        response == null ? null : response.error);
                    if (!string.IsNullOrWhiteSpace(message)) return message;
                }
                catch (Exception)
                {
                    // Fall back to the status because the provider returned non-JSON data.
                }
            }

            return statusCode > 0
                ? "Supabase request failed with status " + statusCode + "."
                : "Supabase request failed.";
        }

        private static bool TryParse(string body, out SupabaseAuthResponse response, out string error)
        {
            response = null;
            error = null;

            if (string.IsNullOrWhiteSpace(body))
            {
                error = "Supabase auth response is empty.";
                return false;
            }

            try
            {
                response = JsonUtility.FromJson<SupabaseAuthResponse>(body);
            }
            catch (Exception exception)
            {
                error = "Supabase auth response JSON is invalid: " + exception.Message;
                return false;
            }

            if (response == null)
            {
                error = "Supabase auth response JSON is invalid.";
                return false;
            }

            return true;
        }

        private static string FirstNonEmpty(params string[] values)
        {
            foreach (string value in values)
            {
                if (!string.IsNullOrWhiteSpace(value)) return value;
            }

            return null;
        }
    }
}
