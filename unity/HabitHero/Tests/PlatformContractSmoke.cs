using System;
using HabitHero.Platform;

internal static class PlatformContractSmoke
{
    private static int failures;

    public static int Main()
    {
        TestSupabaseSettings();
        TestAuthCallbackParsing();
        TestSupabaseRequestBuilder();
        TestSupabaseAuthRequestBuilder();
        TestSupabaseRestRequestBuilder();
        TestSupabaseJsonEscaping();
        TestSupabaseSessionContract();

        if (failures > 0)
        {
            Console.Error.WriteLine("Unity platform contract smoke test failed: " + failures);
            return 1;
        }

        Console.WriteLine("Unity platform contract smoke test passed.");
        return 0;
    }

    private static void TestSupabaseSettings()
    {
        SupabaseClientSettings settings;
        string error;

        Assert(
            SupabaseClientSettings.TryCreate(
                "https://example.supabase.co",
                "sb_publishable_test-key",
                out settings,
                out error),
            "accepts a valid public Supabase configuration");
        Assert(settings != null && settings.Url == "https://example.supabase.co", "preserves the validated Supabase URL");

        Assert(
            !SupabaseClientSettings.TryCreate(
                "ftp://example.supabase.co",
                "sb_publishable_test-key",
                out settings,
                out error),
            "rejects non-http Supabase URLs");
        Assert(
            !SupabaseClientSettings.TryCreate(
                "https://example.supabase.co",
                "service_role_secret",
                out settings,
                out error),
            "rejects service-role keys in a client configuration");
    }

    private static void TestAuthCallbackParsing()
    {
        AuthCallbackPayload payload = AuthCallbackParser.Parse(
            "https://habit-hero.vercel.app/#access_token=access-123&refresh_token=refresh-456&type=recovery");

        Assert(payload.HasSessionPayload, "parses a complete session callback from the URL fragment");
        Assert(
            AuthCallbackParser.GetIntent(
                "https://habit-hero.vercel.app/#access_token=access-123&refresh_token=refresh-456&type=recovery")
            == AuthIntent.PasswordRecovery,
            "recognizes a password-recovery callback");

        AuthCallbackPayload codePayload = AuthCallbackParser.Parse(
            "com.vvstudiocode.habithero://login?code=oauth-code");
        Assert(codePayload.Code == "oauth-code", "parses an OAuth authorization code from the app deep link");
        Assert(
            AuthCallbackParser.GetIntent("com.vvstudiocode.habithero://login?code=oauth-code") == AuthIntent.Login,
            "recognizes the login app deep link");

        AuthCallbackPayload errorPayload = AuthCallbackParser.Parse(
            "com.vvstudiocode.habithero://reset-password#error=access_denied&error_description=expired");
        Assert(errorPayload.Error == "access_denied", "preserves the provider error code");
        Assert(errorPayload.ErrorDescription == "expired", "preserves the provider error description");
    }

    private static void TestSupabaseRequestBuilder()
    {
        SupabaseClientSettings settings;
        string error;
        SupabaseClientSettings.TryCreate(
            "https://example.supabase.co",
            "sb_publishable_test-key",
            out settings,
            out error);

        SupabaseRequestContract request;
        Assert(
            SupabaseRequestBuilder.TryBuildRpc(
                settings,
                "purchase_game_item",
                "access-token",
                "{\"item_id\":\"item-1\"}",
                out request,
                out error),
            "builds an authenticated Supabase RPC request");
        Assert(request != null && request.Method == "POST", "uses POST for RPC calls");
        Assert(
            request != null && request.Url == "https://example.supabase.co/rest/v1/rpc/purchase_game_item",
            "builds the canonical RPC endpoint");
        Assert(
            request != null
                && request.Headers["apikey"] == "sb_publishable_test-key"
                && request.Headers["Authorization"] == "Bearer access-token",
            "sends only the publishable key and current access token");
        Assert(request != null && request.Body == "{\"item_id\":\"item-1\"}", "preserves the RPC JSON body");
        Assert(
            !SupabaseRequestBuilder.TryBuildRpc(
                settings,
                "purchase_game_item;drop_table",
                "access-token",
                "{}",
                out request,
                out error),
            "rejects unsafe RPC function names");
    }

    private static void TestSupabaseAuthRequestBuilder()
    {
        SupabaseClientSettings settings;
        string error;
        SupabaseClientSettings.TryCreate(
            "https://example.supabase.co",
            "sb_publishable_test-key",
            out settings,
            out error);

        SupabaseRequestContract request;
        Assert(
            SupabaseAuthRequestBuilder.TryBuildPasswordGrant(
                settings,
                "parent@example.com",
                "secret-password",
                out request,
                out error),
            "builds the password sign-in request");
        Assert(
            request != null
                && request.Url == "https://example.supabase.co/auth/v1/token?grant_type=password"
                && request.Method == "POST",
            "uses the Supabase password grant endpoint");
        Assert(
            request != null
                && request.Body == "{\"email\":\"parent@example.com\",\"password\":\"secret-password\"}",
            "serializes password sign-in credentials as JSON");

        Assert(
            SupabaseAuthRequestBuilder.TryBuildRefreshGrant(
                settings,
                "refresh-token",
                out request,
                out error),
            "builds the refresh-token request");
        Assert(
            request != null
                && request.Url == "https://example.supabase.co/auth/v1/token?grant_type=refresh_token"
                && request.Body == "{\"refresh_token\":\"refresh-token\"}",
            "uses the refresh grant endpoint and body");

        Assert(
            SupabaseAuthRequestBuilder.TryBuildUser(settings, "access-token", out request, out error),
            "builds the authenticated user request");
        Assert(
            request != null
                && request.Method == "GET"
                && request.Url == "https://example.supabase.co/auth/v1/user"
                && request.Headers["Authorization"] == "Bearer access-token",
            "uses the access token for authenticated user reads");

        Assert(
            SupabaseAuthRequestBuilder.TryBuildPasswordRecovery(
                settings,
                "parent@example.com",
                "com.vvstudiocode.habithero://reset-password",
                out request,
                out error),
            "builds the password recovery request");
        Assert(
            request != null
                && request.Url == "https://example.supabase.co/auth/v1/recover"
                && request.Body == "{\"email\":\"parent@example.com\",\"redirect_to\":\"com.vvstudiocode.habithero://reset-password\"}",
            "preserves the password recovery redirect");

        Assert(
            SupabaseAuthRequestBuilder.TryBuildLogout(settings, "access-token", out request, out error),
            "builds the local Supabase logout request");
        Assert(
            request != null
                && request.Method == "POST"
                && request.Url == "https://example.supabase.co/auth/v1/logout"
                && request.Headers["Authorization"] == "Bearer access-token",
            "authenticates the logout request with the current session");
    }

    private static void TestSupabaseSessionContract()
    {
        SupabaseAuthResponse response = new SupabaseAuthResponse
        {
            access_token = "access-token",
            refresh_token = "refresh-token",
            token_type = "bearer",
            expires_in = 3600,
            user = new SupabaseUser
            {
                id = "user-1",
                email = "parent@example.com",
            },
        };

        SupabaseSession session;
        string error;
        Assert(
            SupabaseSession.TryCreateFromAuthResponse(response, 1000, out session, out error),
            "creates a session from the Supabase auth response");
        Assert(
            session != null
                && session.AccessToken == "access-token"
                && session.RefreshToken == "refresh-token"
                && session.User.Id == "user-1",
            "keeps the access, refresh, and user identity fields");
        Assert(session != null && session.ExpiresAt == 4600, "derives expires_at from expires_in");
        Assert(session != null && session.ShouldRefresh(4500, 120), "refreshes before the access token expires");
        Assert(session != null && !session.ShouldRefresh(2000, 120), "does not refresh a healthy session");

        Assert(
            !SupabaseSession.TryCreateFromAuthResponse(
                new SupabaseAuthResponse { access_token = "only-access" },
                1000,
                out session,
                out error),
            "rejects a session response without a refresh token");
    }

    private static void Assert(bool condition, string description)
    {
        if (condition) return;
        failures += 1;
        Console.Error.WriteLine("FAIL: " + description);
    }

    private static void TestSupabaseRestRequestBuilder()
    {
        SupabaseClientSettings settings;
        string error;
        SupabaseClientSettings.TryCreate(
            "https://example.supabase.co",
            "sb_publishable_test-key",
            out settings,
            out error);

        SupabaseRequestContract request;
        Assert(
            SupabaseRestRequestBuilder.TryBuildTableSelect(
                settings,
                "tasks",
                new[] { new SupabaseRestFilter("child_profile_id", "eq", "child-1") },
                "*",
                "created_at.desc",
                100,
                "access-token",
                out request,
                out error),
            "builds an authenticated PostgREST table request");
        Assert(
            request != null
                && request.Method == "GET"
                && request.Url == "https://example.supabase.co/rest/v1/tasks?select=*&child_profile_id=eq.child-1&order=created_at.desc&limit=100",
            "builds a constrained table URL with ordering and limit");
        Assert(
            request != null
                && request.Headers["apikey"] == "sb_publishable_test-key"
                && request.Headers["Authorization"] == "Bearer access-token",
            "sends the publishable key and session token on table reads");
        Assert(
            !SupabaseRestRequestBuilder.TryBuildTableSelect(
                settings,
                "tasks;drop_table",
                null,
                "*",
                null,
                0,
                "access-token",
                out request,
                out error),
            "rejects unsafe table names");
    }

    private static void TestSupabaseJsonEscaping()
    {
        Assert(
            SupabaseJson.Quote("a\"b\\c\n") == "\"a\\\"b\\\\c\\n\"",
            "escapes JSON string boundaries and control characters");
        Assert(SupabaseJson.NullableString(null) == "null", "preserves JSON null values");
    }
}
