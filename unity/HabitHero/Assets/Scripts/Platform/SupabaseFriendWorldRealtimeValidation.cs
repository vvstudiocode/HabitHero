using System;
using System.Collections.Generic;
using System.Globalization;

namespace HabitHero.Platform
{
    internal static class SupabaseFriendWorldRealtimeValidation
    {
        internal static Dictionary<string, object> AsObject(object value)
        {
            return SupabaseRealtimeMessageParser.AsObject(value);
        }

        internal static string GetString(Dictionary<string, object> record, string key)
        {
            return SupabaseRealtimeMessageParser.GetString(record, key);
        }

        internal static bool TryIdentity(
            Dictionary<string, object> record,
            string key,
            out string value,
            int maximumLength = SupabaseFriendWorldRealtimeContracts.MaxIdentityLength)
        {
            value = GetString(record, key);
            return IsIdentity(value, maximumLength);
        }

        internal static bool TryOptionalCharacter(
            Dictionary<string, object> record,
            out string value)
        {
            value = null;
            if (!record.ContainsKey("characterAssetKey")) return true;
            value = GetString(record, "characterAssetKey");
            return IsIdentity(
                value,
                SupabaseFriendWorldRealtimeContracts.MaxCharacterAssetKeyLength);
        }

        internal static bool TrySequence(
            Dictionary<string, object> record,
            out long value)
        {
            value = 0;
            double number;
            if (!TryNumber(record, "seq", out number)
                || number < 1
                || number > long.MaxValue
                || number != Math.Floor(number))
                return false;
            value = Convert.ToInt64(number, CultureInfo.InvariantCulture);
            return true;
        }

        internal static bool TryInteger(
            Dictionary<string, object> record,
            string key,
            out int value)
        {
            value = 0;
            double number;
            if (!TryNumber(record, key, out number)
                || number < int.MinValue
                || number > int.MaxValue
                || number != Math.Floor(number))
                return false;
            value = Convert.ToInt32(number, CultureInfo.InvariantCulture);
            return true;
        }

        internal static bool TryFloat(
            Dictionary<string, object> record,
            string key,
            out float value)
        {
            value = 0f;
            double number;
            if (!TryNumber(record, key, out number)
                || double.IsNaN(number)
                || double.IsInfinity(number)
                || number < -float.MaxValue
                || number > float.MaxValue)
                return false;
            value = (float)number;
            return true;
        }

        internal static bool TryNonNegative(
            Dictionary<string, object> record,
            string key,
            out double value)
        {
            if (!TryNumber(record, key, out value)) return false;
            return !double.IsNaN(value) && !double.IsInfinity(value) && value >= 0;
        }

        internal static bool TryOneOf(
            Dictionary<string, object> record,
            string key,
            string[] allowed,
            out string value)
        {
            value = GetString(record, key);
            if (value == null) return false;
            foreach (string candidate in allowed)
                if (candidate == value) return true;
            return false;
        }

        internal static bool TryNumber(
            Dictionary<string, object> record,
            string key,
            out double value)
        {
            value = 0;
            if (record == null || !record.ContainsKey(key) || record[key] == null) return false;
            object raw = record[key];
            if (raw is double) { value = (double)raw; return true; }
            if (raw is float) { value = (float)raw; return true; }
            if (raw is int) { value = (int)raw; return true; }
            if (raw is long) { value = (long)raw; return true; }
            return false;
        }

        internal static bool IsIdentity(
            string value,
            int maximumLength = SupabaseFriendWorldRealtimeContracts.MaxIdentityLength)
        {
            if (string.IsNullOrEmpty(value) || value.Length > maximumLength || value.Trim() != value)
                return false;
            foreach (char character in value)
                if (character < 32 || character == 127) return false;
            return true;
        }

        internal static void ValidateAvatarState(SupabaseFriendWorldAvatarState state)
        {
            if (state.version != SupabaseFriendWorldRealtimeContracts.ProtocolVersion
                || !IsIdentity(state.connectionId)
                || !IsIdentity(state.childProfileId)
                || (state.characterAssetKey != null
                    && !IsIdentity(
                        state.characterAssetKey,
                        SupabaseFriendWorldRealtimeContracts.MaxCharacterAssetKeyLength))
                || state.sequence < 1
                || float.IsNaN(state.x)
                || float.IsInfinity(state.x)
                || float.IsNaN(state.z)
                || float.IsInfinity(state.z)
                || Math.Abs(state.x) > SupabaseFriendWorldRealtimeContracts.WorldBoundary
                || Math.Abs(state.z) > SupabaseFriendWorldRealtimeContracts.WorldBoundary
                || float.IsNaN(state.rotationY)
                || float.IsInfinity(state.rotationY)
                || (state.motion != "idle" && state.motion != "walk")
                || (state.emote != "none"
                    && state.emote != "wave"
                    && state.emote != "sit"
                    && state.emote != "dance")
                || double.IsNaN(state.sentAt)
                || double.IsInfinity(state.sentAt)
                || state.sentAt < 0)
            {
                throw new ArgumentException("Invalid friend world avatar state.", "state");
            }
        }
    }
}
