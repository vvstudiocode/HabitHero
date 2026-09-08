using System;
using UnityEngine;

namespace HabitHero.Platform
{
    public static class SupabaseJsonObjectParser
    {
        public static bool TryParseObject<T>(
            string json,
            out T value,
            out string error)
        {
            value = default(T);
            error = null;
            if (string.IsNullOrWhiteSpace(json))
            {
                error = "Supabase returned an empty object response.";
                return false;
            }

            try
            {
                value = JsonUtility.FromJson<T>(json);
            }
            catch (Exception exception)
            {
                error = "Supabase object response is invalid: " + exception.Message;
                return false;
            }

            if (value == null)
            {
                error = "Supabase object response did not contain a value.";
                return false;
            }

            return true;
        }
    }
}
