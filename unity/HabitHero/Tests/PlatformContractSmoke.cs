using System;
using HabitHero.Platform;

internal static class PlatformContractSmoke
{
    private static int failures;

    public static int Main()
    {
        TestSupabaseSettings();
        TestAuthCallbackParsing();

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

    private static void Assert(bool condition, string description)
    {
        if (condition) return;
        failures += 1;
        Console.Error.WriteLine("FAIL: " + description);
    }
}
