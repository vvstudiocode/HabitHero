using System;
using UnityEngine;

namespace HabitHero.Platform
{
    public static class SupabaseSessionSerializer
    {
        public static string Serialize(SupabaseSession session)
        {
            if (session == null) return string.Empty;
            return JsonUtility.ToJson(session);
        }

        public static bool TryDeserialize(
            string serializedSession,
            out SupabaseSession session,
            out string error)
        {
            session = null;
            error = null;

            if (string.IsNullOrWhiteSpace(serializedSession)) return true;

            try
            {
                session = JsonUtility.FromJson<SupabaseSession>(serializedSession);
            }
            catch (Exception exception)
            {
                error = "Saved Supabase session is invalid: " + exception.Message;
                return false;
            }

            if (session == null || !session.HasTokens)
            {
                session = null;
                error = "Saved Supabase session is incomplete.";
                return false;
            }

            return true;
        }
    }
}
