using System;

namespace HabitHero.Platform
{
    [Serializable]
    public sealed class SupabaseUser
    {
        public string id;
        public string email;

        public string Id { get { return id; } }

        public string Email { get { return email; } }
    }

    [Serializable]
    public sealed class SupabaseAuthResponse
    {
        public string access_token;
        public string refresh_token;
        public string token_type;
        public int expires_in;
        public long expires_at;
        public SupabaseUser user;
    }

    [Serializable]
    public sealed class SupabaseSession
    {
        public string access_token;
        public string refresh_token;
        public string token_type;
        public int expires_in;
        public long expires_at;
        public SupabaseUser user;

        public string AccessToken { get { return access_token; } }

        public string RefreshToken { get { return refresh_token; } }

        public long ExpiresAt { get { return expires_at; } }

        public SupabaseUser User { get { return user; } }

        public bool HasTokens
        {
            get
            {
                return !string.IsNullOrEmpty(access_token) && !string.IsNullOrEmpty(refresh_token);
            }
        }

        public bool ShouldRefresh(long nowUnixSeconds, long refreshSkewSeconds)
        {
            return HasTokens
                && expires_at > 0
                && expires_at <= nowUnixSeconds + Math.Max(0, refreshSkewSeconds);
        }

        public SupabaseSession Copy()
        {
            return new SupabaseSession
            {
                access_token = access_token,
                refresh_token = refresh_token,
                token_type = token_type,
                expires_in = expires_in,
                expires_at = expires_at,
                user = user == null
                    ? null
                    : new SupabaseUser { id = user.id, email = user.email },
            };
        }

        public static bool TryCreateFromAuthResponse(
            SupabaseAuthResponse response,
            long nowUnixSeconds,
            out SupabaseSession session,
            out string error)
        {
            session = null;
            error = null;

            if (response == null
                || string.IsNullOrWhiteSpace(response.access_token)
                || string.IsNullOrWhiteSpace(response.refresh_token))
            {
                error = "Supabase auth response did not contain a complete session.";
                return false;
            }

            long expiresAt = response.expires_at > 0
                ? response.expires_at
                : nowUnixSeconds + Math.Max(0, response.expires_in);

            session = new SupabaseSession
            {
                access_token = response.access_token,
                refresh_token = response.refresh_token,
                token_type = string.IsNullOrEmpty(response.token_type) ? "bearer" : response.token_type,
                expires_in = response.expires_in,
                expires_at = expiresAt,
                user = response.user,
            };
            return true;
        }
    }
}
