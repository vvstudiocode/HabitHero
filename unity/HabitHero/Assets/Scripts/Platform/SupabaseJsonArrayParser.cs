using System;
using UnityEngine;

namespace HabitHero.Platform
{
    public static class SupabaseJsonArrayParser
    {
        [Serializable]
        private sealed class ArrayWrapper<T>
        {
            public T[] items;
        }

        public static bool TryParseArray<T>(
            string body,
            out T[] items,
            out string error)
        {
            items = new T[0];
            error = null;

            if (string.IsNullOrWhiteSpace(body) || body.Trim() == "null") return true;

            string trimmed = body.Trim();
            if (!trimmed.StartsWith("[") || !trimmed.EndsWith("]"))
            {
                error = "Supabase response is not a JSON array.";
                return false;
            }

            try
            {
                ArrayWrapper<T> wrapper = JsonUtility.FromJson<ArrayWrapper<T>>(
                    "{\"items\":" + trimmed + "}");
                if (wrapper == null || wrapper.items == null)
                {
                    error = "Supabase JSON array is empty or invalid.";
                    return false;
                }

                items = wrapper.items;
                return true;
            }
            catch (Exception exception)
            {
                error = "Supabase JSON array is invalid: " + exception.Message;
                return false;
            }
        }
    }
}
